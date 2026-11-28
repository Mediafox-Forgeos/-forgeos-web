#!/usr/bin/env bash
# Prueba local de la migración 0010 (pendiente): sobre 0001–0009 en un Postgres efímero.
# Aplicación, idempotencia, clasificación sintética, imágenes sintéticas, topes de campaña,
# rollback exacto a 0009 y reaplicación. Nunca toca un remoto.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl)")}"
TMP="$(mktemp -d)"; PORT="${HF_TEST_PGPORT:-55439}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
P=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t -A)
PEND="$HERE/supabase/migrations-pending"
M10="$PEND/20261128001000_hf_synthetic_guard_campaign.sql"
D10="$HERE/supabase/rollback/20261128001000_hf_synthetic_guard_campaign.down.sql"
fp() { "${P[@]}" -c "select md5(string_agg(x, '|' order by x)) from (
  select table_name||'.'||column_name||':'||data_type||':'||coalesce(column_default,'') as x from information_schema.columns
    where table_schema='public' and table_name in ('usage_budgets','ai_usage','ai_reservations','post_media','brand_contexts','brand_memory','social_posts','post_metric_snapshots')
  union all select conrelid::regclass||':'||conname||':'||pg_get_constraintdef(oid) from pg_constraint
    where conrelid in ('public.usage_budgets'::regclass,'public.post_media'::regclass,'public.ai_usage'::regclass)
  union all select 'trg:'||tgrelid::regclass||':'||tgname from pg_trigger where not tgisinternal
    and tgrelid in ('public.brand_contexts'::regclass,'public.brand_memory'::regclass,'public.social_posts'::regclass,'public.post_metric_snapshots'::regclass,'public.post_media'::regclass)
  union all select 'fn:'||p.proname||':'||md5(p.prosrc)||':'||p.prosecdef from pg_proc p where pronamespace='public'::regnamespace and (proname like 'hf_ai_%' or proname like 'hf_%synthetic%')
  union all select 'acl:'||p.proname||':'||coalesce(array_to_string(p.proacl, ','), '') from pg_proc p where pronamespace='public'::regnamespace and proname like 'hf_ai_%'
  union all select 'grant:'||grantee||':'||table_name||':'||privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('usage_budgets','post_media')) s"; }
"${P[@]}" -f "$HERE/tests/sql/00_supabase_stub.sql"
"${P[@]}" -f "$HERE/tests/sql/05_storage_stub.sql"
for f in "$HERE"/supabase/migrations/*.sql; do "${P[@]}" -f "$f" >/dev/null 2>&1; done
for f in "$PEND"/20261126000700_*.sql "$PEND"/20261126000800_*.sql "$PEND"/20261127000900_*.sql; do "${P[@]}" -f "$f" >/dev/null 2>&1; done
BEFORE="$(fp)"
echo "  ok   0001–0009 aplicadas (huella 0009: ${BEFORE:0:12})"
"${P[@]}" -f "$M10" >/dev/null 2>&1; "${P[@]}" -f "$M10" >/dev/null 2>&1
echo "  ok   0010 aplicada dos veces (idempotente)"
# Las pruebas de 0009 siguen pasando sobre 0010 (regresión del presupuesto).
OUT9="$("${P[@]}" -f "$HERE/tests/sql/43_migration_0009.test.sql" 2>&1)" || { echo "$OUT9" | tail -8; exit 1; }
echo "$OUT9" | grep -q "MIGRATION 0009 TESTS PASSED" || { echo "$OUT9" | tail -8; exit 1; }
echo "  ok   las 17 aserciones de 0009 siguen pasando con 0010"
OUT="$("${P[@]}" -f "$HERE/tests/sql/44_migration_0010.test.sql" 2>&1)" || { echo "$OUT" | tail -8; exit 1; }
echo "$OUT" | grep -c "ok -" | sed 's/^/  ok   aserciones 0010: /'
echo "$OUT" | grep -q "MIGRATION 0010 TESTS PASSED" || { echo "$OUT" | tail -8; exit 1; }
"${P[@]}" -c "delete from public.post_media where source_url ~* '^https://synthetic-media\.heyfoxy\.invalid/'"
"${P[@]}" -f "$D10" >/dev/null
AFTER="$(fp)"
[[ "$BEFORE" == "$AFTER" ]] || { echo "  FAIL el rollback no vuelve exactamente a 0009 ($BEFORE vs $AFTER)"; exit 1; }
echo "  ok   rollback devuelve exactamente a 0009"
"${P[@]}" -f "$M10" >/dev/null 2>&1
echo "  ok   0010 se puede volver a aplicar tras el rollback"
echo "MIGRATION 0010 PASSED"
