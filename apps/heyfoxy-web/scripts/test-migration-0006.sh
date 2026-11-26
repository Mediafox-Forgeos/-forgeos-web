#!/usr/bin/env bash
# Prueba local de la migración 0006: se aplica sobre 0001–0005 en un Postgres
# efímero con stub de Supabase y de Storage. Comprueba: aplicación, idempotencia, RLS y guardas,
# contrato de 0005 intacto, y que el rollback devuelve exactamente al contrato de 0005.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl)")}"
TMP="$(mktemp -d)"; PORT="${HF_TEST_PGPORT:-55434}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
P=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t -A)
M="$HERE/supabase/migrations/20261124000600_hf_metricool_media_sync.sql"
contract() { "${P[@]}" -F '|' -f "$HERE/tests/sql/19_schema_contract_0005.check.sql" | awk -F'|' '$4 != "t"'; }
contract6() { "${P[@]}" -F '|' -f "$HERE/tests/sql/20_schema_contract.check.sql" | awk -F'|' '$4 != "t"'; }

"${P[@]}" -f "$HERE/tests/sql/00_supabase_stub.sql"
"${P[@]}" -f "$HERE/tests/sql/05_storage_stub.sql"
for f in "$HERE"/supabase/migrations/*.sql; do [[ "$f" == "$M" ]] || "${P[@]}" -f "$f"; done
[[ -z "$(contract)" ]] || { echo "contrato 0005 falla antes de 0006"; exit 1; }
echo "  ok   0001–0005 aplicadas; contrato 0005 OK"
"${P[@]}" -f "$M"
"${P[@]}" -f "$M"
echo "  ok   0006 aplicada dos veces (idempotente)"
# Lo que 0006 cambia del contrato 0005 debe ser solo lo esperado (tabla y funciones nuevas).
[[ -z "$(contract6)" ]] || { echo "  FAIL contrato 0006:"; contract6; exit 1; }
echo "  ok   contrato 0006 OK (tests/sql/20)"
"${P[@]}" -f "$HERE/tests/sql/40_migration_0006.test.sql" 2>&1 | grep -E "ok -|PASSED|ASSERT" | sed 's/^NOTICE:  /         /;s/^/  /' | tail -40
"${P[@]}" -f "$HERE/supabase/rollback/20261124000600_hf_metricool_media_sync.down.sql" 2>&1 | grep -v NOTICE || true
"${P[@]}" -c "delete from storage.objects where bucket_id = 'hf-media';" >/dev/null
"${P[@]}" -f "$HERE/supabase/rollback/20261124000600_hf_metricool_media_sync.down.sql"
[[ -z "$(contract)" ]] || { echo "  FAIL el rollback no vuelve al contrato 0005:"; contract; exit 1; }
"${P[@]}" -c "select to_regclass('public.post_media') is null and not exists (select 1 from storage.buckets where id='hf-media')" | grep -q t
echo "  ok   rollback (con el bucket vacío) devuelve exactamente al contrato 0005"
"${P[@]}" -f "$M"
echo "  ok   0006 se puede volver a aplicar tras el rollback"
echo "MIGRATION 0006 PASSED"
