#!/usr/bin/env bash
# Prueba local de la migración 0007 (pendiente): sobre 0001–0006 en un Postgres efímero.
# Aplicación, idempotencia, RLS/roles, contrato 0006 intacto tras el rollback.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl)")}"
TMP="$(mktemp -d)"; PORT="${HF_TEST_PGPORT:-55436}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
P=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t -A)
M="$HERE/supabase/migrations-pending/20261126000700_hf_brand_brain_intel.sql"
contract6() { "${P[@]}" -F '|' -f "$HERE/tests/sql/20_schema_contract.check.sql" | awk -F'|' '$4 != "t"'; }
"${P[@]}" -f "$HERE/tests/sql/00_supabase_stub.sql"
"${P[@]}" -f "$HERE/tests/sql/05_storage_stub.sql"
for f in "$HERE"/supabase/migrations/*.sql; do "${P[@]}" -f "$f" >/dev/null 2>&1; done
[[ -z "$(contract6)" ]] || { echo "contrato 0006 falla antes de 0007"; exit 1; }
echo "  ok   0001–0006 aplicadas; contrato 0006 OK"
"${P[@]}" -f "$M" 2>/dev/null; "${P[@]}" -f "$M" 2>/dev/null
echo "  ok   0007 aplicada dos veces (idempotente)"
OUT="$("${P[@]}" -f "$HERE/tests/sql/41_migration_0007.test.sql" 2>&1)" || { echo "$OUT" | tail -5; exit 1; }
echo "$OUT" | grep -c "ok -" | sed 's/^/  ok   aserciones 0007: /'
echo "$OUT" | grep -q "MIGRATION 0007 TESTS PASSED" || { echo "$OUT" | tail -5; exit 1; }
"${P[@]}" -f "$HERE/supabase/rollback/20261126000700_hf_brand_brain_intel.down.sql" >/dev/null 2>&1
[[ -z "$(contract6)" ]] || { echo "  FAIL el rollback no vuelve al contrato 0006:"; contract6; exit 1; }
echo "  ok   rollback devuelve exactamente al contrato 0006"
"${P[@]}" -f "$M" 2>/dev/null
echo "  ok   0007 se puede volver a aplicar tras el rollback"
echo "MIGRATION 0007 PASSED"
