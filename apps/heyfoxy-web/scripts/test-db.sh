#!/usr/bin/env bash
# Pruebas de aislamiento multiempresa contra un Postgres local efímero.
# No toca ningún proyecto Supabase remoto.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl)")}"
TMP="$(mktemp -d)"
PORT="${HF_TEST_PGPORT:-55432}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t)
"${PSQL[@]}" -f "$HERE/tests/sql/00_supabase_stub.sql"
if [ "${HF_STUB_LEGACY_ACL:-0}" = 1 ]; then
  # Modelo antiguo de Supabase (ALL por defecto) para demostrar que 0004 es determinista.
  "${PSQL[@]}" -c "alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role; alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role; alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role, public;"
fi
for f in "$HERE"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
CONTRACT_FAIL="$("${PSQL[@]}" -A -F '|' -f "$HERE/tests/sql/20_schema_contract.check.sql" | awk -F'|' '$4 != "t"')"
if [ -n "$CONTRACT_FAIL" ]; then echo "SCHEMA CONTRACT FAILED:"; echo "$CONTRACT_FAIL"; exit 1; fi
echo "schema contract: OK"
"${PSQL[@]}" -f "$HERE/tests/sql/10_isolation.test.sql"
echo "DB TESTS PASSED"
