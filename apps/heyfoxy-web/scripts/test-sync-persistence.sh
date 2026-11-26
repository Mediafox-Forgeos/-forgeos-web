#!/usr/bin/env bash
# Hey Foxy — persistencia de la sincronización contra Postgres efímero con 0001–0006, el seed QA
# y la organización del piloto. No toca ningún proyecto remoto.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl)")}"
TMP="$(mktemp -d)"; PORT="${HF_TEST_PGPORT:-55435}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
P=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${P[@]}" -f "$HERE/tests/sql/00_supabase_stub.sql" >/dev/null
for f in "$HERE"/supabase/migrations/*.sql; do "${P[@]}" -f "$f" >/dev/null 2>&1; done
"${P[@]}" -c "insert into auth.users (id, email) select gen_random_uuid(), e from unnest(array['qa-owner@heyfoxy.test','qa-admin@heyfoxy.test','qa-analyst@heyfoxy.test','qa-responder@heyfoxy.test','qa-viewer@heyfoxy.test','qa-owner-b@heyfoxy.test']) e;"
git -C "$HERE" show 867a3aa:apps/heyfoxy-web/supabase/seed/qa_seed.sql | "${P[@]}" >/dev/null
"${P[@]}" -f "$HERE/supabase/seed/hf_org_marca_autorizada.sql" >/dev/null
"${P[@]}" -f "$HERE/supabase/seed/hf_org_medplus_piloto.sql" >/dev/null
cd "$HERE"
HF_TEST_PG="$TMP $PORT" node_modules/.bin/vitest run tests/sync-persistence.pg.test.ts
echo "SYNC PERSISTENCE PASSED"
