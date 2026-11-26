#!/usr/bin/env bash
# Prueba local de la migración 0008 (pendiente): sobre 0001–0007 en un Postgres efímero.
# Aplicación, idempotencia, transiciones y RLS, rollback exacto a 0007. Nunca toca un remoto.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl)")}"
TMP="$(mktemp -d)"; PORT="${HF_TEST_PGPORT:-55437}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
P=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t -A)
M7="$HERE/supabase/migrations-pending/20261126000700_hf_brand_brain_intel.sql"
M8="$HERE/supabase/migrations-pending/20261126000800_hf_brand_memory_review.sql"
D8="$HERE/supabase/rollback/20261126000800_hf_brand_memory_review.down.sql"
fp() { "${P[@]}" -c "select md5(string_agg(x, '|' order by x)) from (
  select column_name||':'||data_type as x from information_schema.columns where table_schema='public' and table_name='brand_memory'
  union all select conname||':'||pg_get_constraintdef(oid) from pg_constraint where conrelid='public.brand_memory'::regclass
  union all select md5(pg_get_functiondef('public.hf_guard_brand_memory_org()'::regprocedure))
  union all select grantee||':'||privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='brand_memory'
  union all select polname||':'||coalesce(pg_get_expr(polqual, polrelid),'')||':'||coalesce(pg_get_expr(polwithcheck, polrelid),'') from pg_policy where polrelid='public.brand_memory'::regclass) s"; }
"${P[@]}" -f "$HERE/tests/sql/00_supabase_stub.sql"
"${P[@]}" -f "$HERE/tests/sql/05_storage_stub.sql"
for f in "$HERE"/supabase/migrations/*.sql; do "${P[@]}" -f "$f" >/dev/null 2>&1; done
"${P[@]}" -f "$M7" >/dev/null 2>&1
BEFORE="$(fp)"
echo "  ok   0001–0007 aplicadas (huella 0007: ${BEFORE:0:12})"
"${P[@]}" -f "$M8" >/dev/null; "${P[@]}" -f "$M8" >/dev/null
echo "  ok   0008 aplicada dos veces (idempotente)"
OUT="$("${P[@]}" -f "$HERE/tests/sql/42_migration_0008.test.sql" 2>&1)" || { echo "$OUT" | tail -5; exit 1; }
echo "$OUT" | grep -c "ok -" | sed 's/^/  ok   aserciones 0008: /'
echo "$OUT" | grep -q "MIGRATION 0008 TESTS PASSED" || { echo "$OUT" | tail -5; exit 1; }
"${P[@]}" -f "$D8" >/dev/null
AFTER="$(fp)"
[[ "$BEFORE" == "$AFTER" ]] || { echo "  FAIL el rollback no vuelve exactamente a 0007 ($BEFORE vs $AFTER)"; exit 1; }
echo "  ok   rollback devuelve exactamente a 0007"
OUT7="$("${P[@]}" -c "select count(*) from public.brand_memory where status not in ('proposed','validated','archived')")"
[[ "$OUT7" == "0" ]] || { echo "  FAIL quedan estados desconocidos para 0007"; exit 1; }
echo "  ok   tras el rollback no quedan estados que 0007 no conozca"
"${P[@]}" -f "$M8" >/dev/null
echo "  ok   0008 se puede volver a aplicar tras el rollback"
echo "MIGRATION 0008 PASSED"
