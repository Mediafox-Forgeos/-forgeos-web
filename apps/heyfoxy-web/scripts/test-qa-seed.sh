#!/usr/bin/env bash
# Prueba local (Postgres efímero) de las correcciones del seed QA: qa_fix_001, qa_fix_002,
# qa_refresh_dates, la exportación de rollback y los rollbacks. Reproduce el estado remoto:
# seed de Gate B (commit 867a3aa) cargado y envejecido 10 días. No toca ningún proyecto remoto.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl)")}"
TMP="$(mktemp -d)"; PORT="${HF_TEST_PGPORT:-55433}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
P=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t -A)
S="$HERE/supabase/seed"
ok() { echo "  ok   $1"; }
fail() { echo "  FAIL $1"; exit 1; }
q() { "${P[@]}" -c "$1"; }

"${P[@]}" -f "$HERE/tests/sql/00_supabase_stub.sql"
for f in "$HERE"/supabase/migrations/*.sql; do "${P[@]}" -f "$f"; done
q "insert into auth.users (id, email) select gen_random_uuid(), e from unnest(array['qa-owner@heyfoxy.test','qa-admin@heyfoxy.test','qa-analyst@heyfoxy.test','qa-responder@heyfoxy.test','qa-viewer@heyfoxy.test','qa-owner-b@heyfoxy.test']) e;"
git -C "$HERE" show 867a3aa:apps/heyfoxy-web/supabase/seed/qa_seed.sql > "$TMP/seed_gate_b.sql"
"${P[@]}" -f "$TMP/seed_gate_b.sql" >/dev/null
ok "seed de Gate B cargado ($(md5 -q "$TMP/seed_gate_b.sql" 2>/dev/null || md5sum "$TMP/seed_gate_b.sql" | cut -c1-32))"

# Envejecer 10 días (estado del Preview: fechas relativas al día de carga).
q "update public.social_comments set published_at = published_at - interval '10 days';
   update public.social_mentions set published_at = published_at - interval '10 days';
   update public.social_posts set published_at = published_at - interval '10 days';
   update public.post_metric_snapshots set captured_at = captured_at - interval '10 days';
   update public.sentiment_analyses set created_at = created_at - interval '10 days';
   update public.alerts set created_at = created_at - interval '10 days';"

# Filas «manuales» (validación de Gate D) que nada debe tocar.
A=9a000000-0000-4000-a000-0000000000a1
q "insert into public.alerts (organization_id, title, summary, severity, priority_score, review_status, dedupe_key, is_synthetic, created_at)
   values ('$A', 'alerta manual', 'creada en validación', 'high', 70, 'pending', 'manual-1', false, now() - interval '40 days');"
fp() { q "select md5(string_agg(x, ',' order by x)) from (
  select 'u'||id||email x from auth.users union all select 'm'||organization_id||user_id||role from public.memberships
  union all select 'i'||id||coalesce(updated_at::text,'') from public.incidents union all select 'e'||id||created_at from public.incident_events
  union all select 'a'||id||created_at from public.audit_logs where action not like 'qa_%'
  union all select 'l'||id||created_at||coalesce(reviewed_at::text,'') from public.alerts where not is_synthetic) t;"; }
BEFORE="$(fp)"

# Rollback: exportación de solo lectura antes de cambiar nada.
"${P[@]}" -f "$S/qa_dates_rollback_export.sql" > "$TMP/rollback.sql"
DATES_BEFORE="$(q "select md5(string_agg(published_at::text, ',' order by id)) from public.social_comments where is_synthetic")"
ok "exportación de rollback: $(grep -c '^update' "$TMP/rollback.sql") sentencias"

# qa_fix_001
N="$(q "select count(*) from public.social_comments c join public.social_posts p on p.id = c.post_id where c.is_synthetic and c.platform <> p.platform")"
[[ "$N" == 6 ]] || fail "se esperaban 6 comentarios en otra red, hay $N"
"${P[@]}" -f "$S/qa_fix_001_comment_platform.sql"
"${P[@]}" -f "$S/qa_fix_001_comment_platform.sql"
ok "qa_fix_001: 6 → 0 comentarios en otra red; segunda ejecución sin cambios"

# qa_fix_002 + comprobaciones
"${P[@]}" -f "$S/qa_fix_002_date_spread.sql" 2>"$TMP/n2" >/dev/null
grep -q "comentarios: 20" "$TMP/n2" || fail "qa_fix_002 no actualizó 20 comentarios: $(cat "$TMP/n2")"
if "${P[@]}" -f "$S/qa_fix_002_date_spread.sql" >/dev/null 2>&1; then fail "qa_fix_002 se dejó ejecutar dos veces"; fi
ok "qa_fix_002 aplicado; una segunda ejecución se rechaza"
BAD="$("${P[@]}" -F '|' -f "$HERE/tests/sql/30_qa_seed_fixes.check.sql" | awk -F'|' '$3 != "true"')"
[[ -z "$BAD" ]] || fail "comprobaciones: $BAD"
"${P[@]}" -F '|' -f "$HERE/tests/sql/30_qa_seed_fixes.check.sql" | sed 's/^/         /'

# qa_refresh_dates: idempotente; tras 3 días, desplaza en bloque y conserva distancias.
"${P[@]}" -f "$S/qa_refresh_dates.sql" 2>"$TMP/n3" >/dev/null
grep -q "Sin cambios" "$TMP/n3" || fail "refresh no fue idempotente"
q "update public.social_comments set published_at = published_at - interval '3 days' where is_synthetic;
   update public.social_mentions set published_at = published_at - interval '3 days' where is_synthetic;
   update public.social_posts set published_at = published_at - interval '3 days' where is_synthetic;
   update public.post_metric_snapshots set captured_at = captured_at - interval '3 days' where is_synthetic;
   update public.sentiment_analyses set created_at = created_at - interval '3 days' where model = 'qa-seed';
   update public.alerts set created_at = created_at - interval '3 days' where is_synthetic;"
GAPS="$(q "select md5(string_agg(g::text, ',' order by id)) from (select id, published_at - min(published_at) over () g from public.social_comments where is_synthetic) t")"
"${P[@]}" -f "$S/qa_refresh_dates.sql" 2>"$TMP/n4" >/dev/null
grep -q "Desplazamiento aplicado" "$TMP/n4" || fail "refresh no desplazó"
[[ "$GAPS" == "$(q "select md5(string_agg(g::text, ',' order by id)) from (select id, published_at - min(published_at) over () g from public.social_comments where is_synthetic) t")" ]] || fail "refresh alteró las distancias"
BAD="$("${P[@]}" -F '|' -f "$HERE/tests/sql/30_qa_seed_fixes.check.sql" | awk -F'|' '$3 != "true"' | grep -v 'comentarios después' || true)"
[[ -z "$BAD" ]] || fail "tras refresh: $BAD"
ok "qa_refresh_dates: idempotente; desplaza en bloque y conserva distancias"

[[ "$BEFORE" == "$(fp)" ]] || fail "se modificaron usuarios, membresías, incidentes, eventos, auditoría o filas manuales"
ok "usuarios, membresías, incidentes, incident_events, auditoría y filas manuales intactos"

# Rollbacks
"${P[@]}" -f "$TMP/rollback.sql"
"${P[@]}" -f "$S/qa_fix_001_rollback.sql"
[[ "$DATES_BEFORE" == "$(q "select md5(string_agg(published_at::text, ',' order by id)) from public.social_comments where is_synthetic")" ]] || fail "el rollback de fechas no restauró el estado"
[[ "$(q "select count(*) from public.social_comments c join public.social_posts p on p.id = c.post_id where c.is_synthetic and c.platform <> p.platform")" == 6 ]] || fail "rollback de qa_fix_001"
ok "rollback de fechas y de qa_fix_001 restauran el estado exacto anterior"
# Organización independiente para la marca real (GO 1, punto 6), sobre 0006 y el seed QA.
AU="$(q "select md5(string_agg(x, ',' order by x)) from (select 'p'||id x from public.social_posts union all select 'c'||id from public.social_comments union all select 'm'||organization_id||user_id||role from public.memberships) t")"
"${P[@]}" -f "$S/hf_org_marca_autorizada.sql"
"${P[@]}" -f "$S/hf_org_marca_autorizada.sql"
C=9c000000-0000-4000-a000-0000000000c1
[[ "$(q "select is_demo from public.organizations where id = '$C'")" == f ]] || fail "la organización de la marca debe ser NO demo"
[[ "$(q "select count(*) from public.memberships where organization_id = '$C'")" == 1 ]] || fail "un único miembro"
[[ "$(q "select count(*) from public.audit_logs where action = 'hf_org_marca_autorizada_creada'")" == 1 ]] || fail "registro de auditoría único"
[[ "$(q "select count(*) from public.memberships m join public.memberships n on n.user_id = m.user_id and n.organization_id <> m.organization_id where m.organization_id = '$C'")" == 1 ]] || fail "qa-owner conserva su membresía en Clínica Aurora"
[[ "$AU" == "$(q "select md5(string_agg(x, ',' order by x)) from (select 'p'||id x from public.social_posts union all select 'c'||id from public.social_comments union all select 'm'||organization_id||user_id||role from public.memberships where organization_id <> '$C') t")" ]] || fail "la organización nueva alteró datos o miembros de Aurora/Horizonte"
ok "organización de la marca autorizada: no demo, 1 owner, fuente pausada, idempotente; Aurora y Horizonte intactas"
# Piloto MedPlus: renombrado con el mismo UUID y registro de autorización (doc 20).
"${P[@]}" -f "$S/hf_org_medplus_piloto.sql"
"${P[@]}" -f "$S/hf_org_medplus_piloto.sql"
[[ "$(q "select name || '|' || slug from public.organizations where id = '$C'")" == "MedPlus · Piloto QA|medplus-piloto-qa" ]] || fail "renombrado MedPlus"
[[ "$(q "select count(*) from public.audit_logs where action = 'hf_medplus_autorizacion_registrada'")" == 1 ]] || fail "registro de autorización único"
[[ "$AU" == "$(q "select md5(string_agg(x, ',' order by x)) from (select 'p'||id x from public.social_posts union all select 'c'||id from public.social_comments union all select 'm'||organization_id||user_id||role from public.memberships where organization_id <> '$C') t")" ]] || fail "el renombrado alteró Aurora/Horizonte"
ok "piloto MedPlus: mismo UUID, renombrada, autorización registrada una vez, idempotente; Aurora y Horizonte intactas"
# La fuente de Aurora no puede conectarse ni recibir datos reales; la marca no se comparte entre organizaciones.
if q "update public.data_sources set status = 'connected' where id = '9a000000-0000-4000-c000-000000000002'" 2>/dev/null; then fail "Aurora (demo) aceptó una fuente real conectada"; fi
q "update public.data_sources set external_account_ref = '700001', status = 'connected' where id = '9c000000-0000-4000-c000-000000000001'"
if q "update public.data_sources set external_account_ref = '700001' where id = '9a000000-0000-4000-c000-000000000002'" 2>/dev/null; then fail "la misma marca se vinculó a dos organizaciones"; fi
q "insert into public.social_posts (organization_id, data_source_id, platform, external_id, is_synthetic) values ('$C', '9c000000-0000-4000-c000-000000000001', 'instagram', 'real-ig-1', false)"
ok "datos reales solo en la organización autorizada; Aurora los rechaza; una marca, una organización"
echo "QA SEED FIXES PASSED"
