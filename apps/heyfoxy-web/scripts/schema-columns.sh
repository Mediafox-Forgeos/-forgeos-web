#!/usr/bin/env bash
# Hey Foxy — contrato de columnas de las tablas que escribe la sincronización, generado desde
# las migraciones versionadas en un Postgres efímero (no toca ningún proyecto remoto).
# Uso: scripts/schema-columns.sh > tests/schema/columns-0006.json
# La misma consulta, en solo lectura contra heyfoxy-qa, debe devolver el mismo JSON.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl)")}"
TMP="$(mktemp -d)"; PORT="${HF_TEST_PGPORT:-55434}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
P=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t -A)
"${P[@]}" -f "$HERE/tests/sql/00_supabase_stub.sql" >/dev/null
for f in "$HERE"/supabase/migrations/*.sql; do "${P[@]}" -f "$f" >/dev/null; done
"${P[@]}" -f "$HERE/tests/sql/50_sync_columns.sql"
