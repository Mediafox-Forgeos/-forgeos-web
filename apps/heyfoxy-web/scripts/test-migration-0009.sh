#!/usr/bin/env bash
# Prueba local de la migración 0009 (pendiente): sobre 0001–0008 en un Postgres efímero.
# Aplicación, idempotencia, reservas/presupuesto/permisos, rollback exacto a 0008. Nunca toca un remoto.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl)")}"
TMP="$(mktemp -d)"; PORT="${HF_TEST_PGPORT:-55438}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
P=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t -A)
M7="$HERE/supabase/migrations-pending/20261126000700_hf_brand_brain_intel.sql"
M8="$HERE/supabase/migrations-pending/20261126000800_hf_brand_memory_review.sql"
M9="$HERE/supabase/migrations-pending/20261127000900_hf_ai_engine.sql"
D9="$HERE/supabase/rollback/20261127000900_hf_ai_engine.down.sql"
fp() { "${P[@]}" -c "select md5(string_agg(x, '|' order by x)) from (
  select column_name||':'||data_type||':'||coalesce(column_default,'') as x from information_schema.columns where table_schema='public' and table_name='ai_usage'
  union all select conname||':'||pg_get_constraintdef(oid) from pg_constraint where conrelid='public.ai_usage'::regclass
  union all select indexname||':'||indexdef from pg_indexes where schemaname='public' and tablename='ai_usage'
  union all select 'tbl:'||tablename from pg_tables where schemaname='public' and tablename='ai_reservations'
  union all select 'fn:'||proname from pg_proc where pronamespace='public'::regnamespace and proname like 'hf_ai_%'
  union all select grantee||':'||privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='ai_usage'
  union all select polname||':'||coalesce(pg_get_expr(polqual, polrelid),'') from pg_policy where polrelid='public.ai_usage'::regclass) s"; }
"${P[@]}" -f "$HERE/tests/sql/00_supabase_stub.sql"
"${P[@]}" -f "$HERE/tests/sql/05_storage_stub.sql"
for f in "$HERE"/supabase/migrations/*.sql; do "${P[@]}" -f "$f" >/dev/null 2>&1; done
"${P[@]}" -f "$M7" >/dev/null 2>&1
"${P[@]}" -f "$M8" >/dev/null 2>&1
BEFORE="$(fp)"
echo "  ok   0001–0008 aplicadas (huella 0008: ${BEFORE:0:12})"
"${P[@]}" -f "$M9" >/dev/null 2>&1; "${P[@]}" -f "$M9" >/dev/null 2>&1
echo "  ok   0009 aplicada dos veces (idempotente)"
OUT="$("${P[@]}" -f "$HERE/tests/sql/43_migration_0009.test.sql" 2>&1)" || { echo "$OUT" | tail -8; exit 1; }
echo "$OUT" | grep -c "ok -" | sed 's/^/  ok   aserciones 0009: /'
echo "$OUT" | grep -q "MIGRATION 0009 TESTS PASSED" || { echo "$OUT" | tail -8; exit 1; }
"${P[@]}" -f "$D9" >/dev/null
AFTER="$(fp)"
[[ "$BEFORE" == "$AFTER" ]] || { echo "  FAIL el rollback no vuelve exactamente a 0008 ($BEFORE vs $AFTER)"; exit 1; }
echo "  ok   rollback devuelve exactamente a 0008"
ROWS="$("${P[@]}" -c "select count(*) from public.ai_usage")"
echo "  ok   tras el rollback ai_usage conserva sus filas ($ROWS) con las columnas de 0008"
"${P[@]}" -f "$M9" >/dev/null 2>&1
echo "  ok   0009 se puede volver a aplicar tras el rollback"
echo "MIGRATION 0009 PASSED"
