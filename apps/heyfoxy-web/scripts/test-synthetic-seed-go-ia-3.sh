#!/usr/bin/env bash
# Prueba local (Postgres efímero) del seed sintético de GO-IA-3 y su rollback, sobre 0001–0010 con
# el seed QA de Gate B y una organización REAL simulada (como MedPlus, con datos ficticios marcados
# como reales). Comprueba: carga e idempotencia, muestra comparable, Brand Brain sintético, imágenes
# propias, que la organización real no cambia, y que el rollback deja todo como estaba.
# No toca ningún proyecto remoto.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl)")}"
TMP="$(mktemp -d)"; PORT="${HF_TEST_PGPORT:-55444}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
P=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -t -A)
S="$HERE/supabase/seed"; PEND="$HERE/supabase/migrations-pending"
ok() { echo "  ok   $1"; }
fail() { echo "  FAIL $1"; exit 1; }
q() { "${P[@]}" -c "$1"; }
A=9a000000-0000-4000-a000-0000000000a1; B=9b000000-0000-4000-a000-0000000000b1; R=9c000000-0000-4000-a000-0000000000c1

"${P[@]}" -f "$HERE/tests/sql/00_supabase_stub.sql"; "${P[@]}" -f "$HERE/tests/sql/05_storage_stub.sql"
for f in "$HERE"/supabase/migrations/*.sql "$PEND"/*.sql; do "${P[@]}" -f "$f" >/dev/null 2>&1; done
q "insert into auth.users (id, email) select gen_random_uuid(), e from unnest(array['qa-owner@heyfoxy.test','qa-admin@heyfoxy.test','qa-analyst@heyfoxy.test','qa-responder@heyfoxy.test','qa-viewer@heyfoxy.test','qa-owner-b@heyfoxy.test']) e;"
"${P[@]}" -f "$S/qa_seed.sql" >/dev/null
# Estado previo de Aurora como en QA: Brand Brain «[PRUEBA QA]» v2 y un aprendizaje propuesto.
q "insert into public.brand_contexts (organization_id, identity) values ('$A', '{}');
   insert into public.brand_memory (organization_id, kind, title, body) values ('$A', 'learning', 'Propuesta previa', 'x');"
# Organización REAL simulada (ficticia) con una publicación «real» y su imagen de CDN.
q "insert into public.organizations (id, name, slug, is_demo) values ('$R', 'Real simulada', 'real-simulada', false);
   insert into public.data_sources (id, organization_id, provider, display_name) values ('9c000000-0000-4000-c000-000000000001', '$R', 'metricool', 'Metricool');
   insert into public.social_posts (id, organization_id, data_source_id, platform, external_id, body) values ('9c000000-0000-4000-e000-000000000001', '$R', '9c000000-0000-4000-c000-000000000001', 'instagram', 'real-1', 'publicación real ficticia');
   insert into public.post_metric_snapshots (organization_id, post_id, likes, reach) values ('$R', '9c000000-0000-4000-e000-000000000001', 5, 100);
   insert into public.post_media (organization_id, post_id, kind, source_url) values ('$R', '9c000000-0000-4000-e000-000000000001', 'image', 'https://scontent.cdninstagram.com/r.jpg');"
# Contenido «[PRUEBA QA]» exacto de QA: el que restaura el rollback (sin publicaciones que borrar).
"${P[@]}" -f "$S/qa_synthetic_go_ia_3_rollback.sql" >/dev/null
fp() { q "select md5(string_agg(x, '|' order by x)) from (
  select 'p'||id||organization_id||external_id||coalesce(body,'')||is_synthetic x from public.social_posts
  union all select 's'||post_id||coalesce(likes,0)||coalesce(reach,0)||is_synthetic from public.post_metric_snapshots
  union all select 'm'||post_id||source_url from public.post_media
  union all select 'b'||organization_id||identity::text||strategy::text||campaigns::text||is_synthetic from public.brand_contexts
  union all select 'k'||organization_id||title||status||is_synthetic from public.brand_memory
  union all select 'o'||id||name||is_demo from public.organizations
  union all select 'u'||organization_id||ai_monthly_usd from public.usage_budgets) s"; }
fpr() { q "select md5(string_agg(x, '|' order by x)) from (
  select 'p'||id||body||is_synthetic x from public.social_posts where organization_id = '$R'
  union all select 's'||post_id||likes from public.post_metric_snapshots where organization_id = '$R'
  union all select 'm'||source_url from public.post_media where organization_id = '$R'
  union all select 'b'||identity::text from public.brand_contexts where organization_id = '$R') s"; }
BEFORE="$(fp)"; REAL="$(fpr)"
ok "base: 0001–0010, seed QA de Gate B, Aurora v$(q "select version from public.brand_contexts where organization_id='$A'") «[PRUEBA QA]», organización real simulada"

"${P[@]}" -f "$S/qa_synthetic_go_ia_3.sql" >/dev/null
AFTER1="$(fp)"
"${P[@]}" -f "$S/qa_synthetic_go_ia_3.sql" >/dev/null
[[ "$(fp)" == "$AFTER1" ]] || fail "el seed no es idempotente"
ok "seed cargado dos veces (idempotente)"
[[ "$(q "select count(*) from public.social_posts where external_id like 'goia3-%' and organization_id = '$A'")" == 13 ]] || fail "Aurora: 13 publicaciones"
[[ "$(q "select count(*) from public.social_posts where external_id like 'goia3-%' and organization_id = '$B'")" == 13 ]] || fail "Horizonte: 13 publicaciones"
MIN="$(q "select min(n) from (select count(*) n from public.social_posts where external_id like 'goia3-%'
  group by organization_id, platform, case when content_type in ('reel','video') then 'video' else 'static' end) g")"
[[ "$MIN" -ge 4 ]] || fail "cada red y grupo de formato necesita ≥ 4 publicaciones (3 comparables); mínimo $MIN"
ok "26 publicaciones; ≥ 4 por red y formato (≥ 3 comparables cada una)"
[[ "$(q "select count(*) from public.social_posts where external_id like 'goia3-%' and not is_synthetic")" == 0 ]] || fail "todo sintético"
[[ "$(q "select count(*) from public.post_metric_snapshots s join public.social_posts p on p.id = s.post_id where p.external_id like 'goia3-%' and s.is_synthetic")" -ge 70 ]] || fail "mediciones históricas"
[[ "$(q "select count(*) from public.post_media where source_url like 'https://synthetic-media.heyfoxy.invalid/%'")" == 26 ]] || fail "26 imágenes propias"
for f in $(q "select substring(source_url from 'invalid/(.*)$') from public.post_media where source_url like 'https://synthetic-media.heyfoxy.invalid/%'"); do
  [[ -f "$HERE/public/synthetic-media/$f" ]] || fail "falta la imagen $f"; done
ok "77 mediciones sintéticas; 26 imágenes propias y todas existen en public/synthetic-media"
[[ "$(q "select string_agg(is_synthetic::text || ':' || jsonb_array_length(strategy->'pillars') || ':' || jsonb_array_length(campaigns), ',' order by organization_id) from public.brand_contexts where organization_id in ('$A','$B')")" == "true:3:3,true:3:3" ]] || fail "Brand Brain sintético con 3 pilares y 3 campañas"
[[ "$(q "select count(*) from public.brand_memory where organization_id in ('$A','$B') and status = 'validated' and is_synthetic")" == 4 ]] || fail "4 aprendizajes validados"
ok "Brand Brain sintético (3 pilares y 3 campañas por marca) y 4 aprendizajes validados"
[[ "$(fpr)" == "$REAL" ]] || fail "la organización real cambió"
ok "la organización real no cambió"
# Ninguna fila sintética nueva fuera de las organizaciones demo.
[[ "$(q "select count(*) from public.social_posts p join public.organizations o on o.id = p.organization_id where p.is_synthetic and not o.is_demo")" == 0 ]] || fail "sintéticos fuera de demo"

"${P[@]}" -f "$S/qa_synthetic_go_ia_3_rollback.sql" >/dev/null
[[ "$(fp)" == "$BEFORE" ]] || fail "el rollback no restaura el estado previo"
ok "rollback: publicaciones, mediciones, imágenes, aprendizajes y Brand Brain vuelven al estado previo"
"${P[@]}" -f "$S/qa_synthetic_go_ia_3.sql" >/dev/null
[[ "$(fp)" == "$AFTER1" ]] || fail "no se puede volver a cargar tras el rollback"
ok "el seed se puede volver a cargar tras el rollback"
echo "SYNTHETIC SEED GO-IA-3 PASSED"
