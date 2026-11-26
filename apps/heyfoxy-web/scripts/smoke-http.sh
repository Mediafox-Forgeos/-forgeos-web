#!/usr/bin/env bash
# Hey Foxy — smoke HTTP del Command Center en modo demo (build local, sin servicios externos).
# Uso: pnpm build && scripts/smoke-http.sh   (levanta `next start` en un puerto local y lo detiene al final)
set -uo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${HF_SMOKE_PORT:-3199}"
BASE="http://127.0.0.1:$PORT"
ORG_A="00000000-0000-4000-a000-0000000000a1" # Clínica Aurora (DEMO)
ORG_B="00000000-0000-4000-a000-0000000000b1" # Banco Horizonte (DEMO)
PASS=0
FAILS=0

cd "$APP"
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  npx next start -p "$PORT" -H 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in $(seq 1 60); do curl -s -o /dev/null "$BASE/api/health" && break; sleep 0.5; done

check() { # nombre, condición
  if eval "$2"; then PASS=$((PASS + 1)); printf '  ok   %s\n' "$1"
  else FAILS=$((FAILS + 1)); printf '  FAIL %s\n' "$1"; fi
}
get() { curl -s -o /dev/null -w '%{http_code}' -b "$2" "$BASE$1"; }
body() { curl -s -b "$2" "$BASE$1"; }

echo "Smoke HTTP — $BASE"
H="$(curl -s "$BASE/api/health")"
check "health en modo demo" '[[ "$H" == *"\"dataMode\":\"demo\""* ]]'
check "health: WhatsApp en simulate" '[[ "$H" == *"\"whatsappMode\":\"simulate\""* ]]'
check "health no expone secretos" '[[ "$H" != *"KEY"* && "$H" != *"TOKEN"* && "$H" != *"KEK"* ]]'
HDR="$(curl -sI "$BASE/login")"
check "X-Frame-Options DENY" 'grep -qi "x-frame-options: DENY" <<<"$HDR"'
check "X-Robots-Tag noindex" 'grep -qi "x-robots-tag: noindex" <<<"$HDR"'
check "sin cabecera X-Powered-By" '! grep -qi "x-powered-by" <<<"$HDR"'

# Autenticación
for p in / /alertas /incidentes /cobertura /whatsapp /uso /configuracion; do
  check "sin sesión $p → 307 login" '[[ "$(get "$p" "")" == "307" ]]'
done
check "usuario inexistente → 307" '[[ "$(get / "hf_demo_user=demo-user-forged")" == "307" ]]'

# Command Center: todas las vistas responden para el owner
OWNER="hf_demo_user=demo-user-owner; hf_org=$ORG_A"
for p in / /conversaciones /alertas /revision /incidentes /temas /publicaciones /reportes /cobertura /whatsapp /uso /configuracion; do
  check "owner $p → 200" '[[ "$(get "$p" "$OWNER")" == "200" ]]'
done
check "banner DEMO visible" '[[ "$(body / "$OWNER")" == *"DEMO"* ]]'
check "aviso de cobertura parcial en overview" '[[ "$(body / "$OWNER")" == *"obertura"* ]]'

# Aislamiento multiempresa: el banco falsifica la cookie de la clínica
BANK="hf_demo_user=demo-user-bank; hf_org=$ORG_A"
BB="$(body / "$BANK")"
check "banco con cookie forjada ve Banco Horizonte" '[[ "$BB" == *"Banco Horizonte"* ]]'
check "banco con cookie forjada NO ve Clínica Aurora" '[[ "$BB" != *"Clínica Aurora"* ]]'
BA="$(body /alertas "$BANK")"
check "alertas del banco sin datos de la clínica" '[[ "$BA" != *"Clínica Aurora"* ]]'
BP="$(body /publicaciones "$BANK")"
check "publicaciones del banco sin datos de la clínica" '[[ "$BP" != *"Clínica Aurora"* && "$BP" == *"Banco Horizonte"* ]]'
BR="$(body /reportes "$BANK")"
check "reportes del banco sin datos de la clínica" '[[ "$BR" != *"Clínica Aurora"* ]]'
check "owner ve el detalle de una publicación de la clínica" '[[ "$(get /publicaciones/demo-clinica-aurora-post-instagram "$OWNER")" == "200" ]]'
check "banco NO abre la publicación de la clínica por URL directa" '[[ "$(get /publicaciones/demo-clinica-aurora-post-instagram "$BANK")" == "404" ]]'
check "detalle muestra comentarios clasificados" '[[ "$(body /publicaciones/demo-clinica-aurora-post-instagram "$OWNER")" == *"Comentarios clasificados por Hey Foxy"* ]]'
# Foxy Intelligence (WO-HF-V2-INTELLIGENCE-001)
check "detalle con Foxy Content Intelligence" '[[ "$(body /publicaciones/demo-clinica-aurora-post-instagram "$OWNER")" == *"¿Qué podemos aprender de esta publicación?"* ]]'
check "Ask Foxy responde 200" '[[ "$(get /foxy "$OWNER")" == "200" ]]'
check "Foxy Brand Brain responde 200" '[[ "$(get /brand-brain "$OWNER")" == "200" ]]'
check "Brand Brain del banco no muestra el contexto de la clínica" '[[ "$(body /brand-brain "$BANK")" != *"Clínica Aurora (ficticia)"* ]]'
check "reportes muestran resúmenes ejecutivos" '[[ "$(body /reportes "$OWNER")" == *"Resúmenes ejecutivos"* ]]'

# Interfaz V2 (por defecto) y tema clásico como alternativa (D-1)
check "Inicio V2 por defecto" '[[ "$(body / "$OWNER")" == *"Hola, <!-- -->Laura"* ]]'
check "tema clásico conserva el Resumen V1" '[[ "$(body / "$OWNER; hf_ui=legacy")" == *"Resumen · Clínica Aurora"* ]]'
check "tema clásico: detalle con comentarios asociados" '[[ "$(body /publicaciones/demo-clinica-aurora-post-instagram "$OWNER; hf_ui=legacy")" == *"Comentarios asociados"* ]]'
check "tema desconocido vuelve a V2" '[[ "$(body / "$OWNER; hf_ui=v9")" == *"Hola, <!-- -->Laura"* ]]'
check "Social Explorer V2" '[[ "$(body /publicaciones "$OWNER")" == *"Sin vista previa"* ]]'
# Refinamiento V2 (WO-HF-V2-REFINEMENT-001)
check "detalle: volver conserva filtros y periodo" '[[ "$(body "/publicaciones/demo-clinica-aurora-post-instagram?platform=instagram&periodo=30d" "$OWNER")" == *"href=\"/publicaciones?platform=instagram&amp;periodo=30d\""* ]]'
check "detalle: análisis IA, prioridad y confianza por comentario" '[[ "$(body /publicaciones/demo-clinica-aurora-post-instagram "$OWNER")" == *"Clasificación por reglas"*"Confianza"* ]]'
check "filtro inválido en el detalle se descarta" '[[ "$(get "/publicaciones/demo-clinica-aurora-post-instagram?platform=__proto__" "$OWNER")" == "200" ]]'
VIEWER0="hf_demo_user=demo-user-viewer; hf_org=$ORG_A"
# Fuentes y cobertura V2 + Metricool (WO-HF-METRICOOL-INTEGRATION-001)
SRC="$(body /cobertura "$OWNER")"
check "fuentes V2: tarjeta de Metricool en simulación" '[[ "$SRC" == *"Metricool"* && "$SRC" == *"Simulación"* ]]'
check "fuentes V2: sin token en el HTML" '[[ "$SRC" != *"fixture-token"* && "$SRC" != *"X-Mc-Auth"* ]]'
check "fuentes clásico conserva la vista V1" '[[ "$(body /cobertura "$OWNER; hf_ui=legacy")" == *"Etapa técnica"* ]]'
check "sync programada desactivada (503)" '[[ "$(get /api/sync/cron "$OWNER")" == "503" ]]'
check "viewer sin acciones de fuente" '[[ "$(body /cobertura "$VIEWER0")" != *"Conectar marca"* ]]'
check "login V2 por defecto" '[[ "$(body /login "")" == *"Ingresa a tu espacio"* ]]'
check "login clásico con tema legacy" '[[ "$(body /login "hf_ui=legacy")" == *"Command Center"* && "$(body /login "hf_ui=legacy")" != *"Ingresa a tu espacio"* ]]'
check "catálogo /ds en demo → 200" '[[ "$(get /ds "$OWNER")" == "200" ]]'
check "buscador global → 200" '[[ "$(get "/buscar?q=citas" "$OWNER")" == "200" ]]'
BS="$(body "/buscar?q=a" "$BANK")"
check "buscador del banco sin datos de la clínica" '[[ "$BS" != *"Clínica Aurora"* && "$BS" != *"clinica-aurora"* ]]'
check "periodo inválido no rompe Inicio" '[[ "$(get "/?periodo=__proto__" "$OWNER")" == "200" ]]'

# Roles
VIEWER="hf_demo_user=demo-user-viewer; hf_org=$ORG_A"
VW="$(body /whatsapp "$VIEWER")"
check "viewer no ve destinatarios de WhatsApp" '[[ "$VW" != *"+57"* ]]'
ANALYST="hf_demo_user=demo-user-analyst; hf_org=$ORG_A"
AW="$(body /whatsapp "$ANALYST")"
check "analyst no ve destinatarios de WhatsApp" '[[ "$AW" != *"+57"* ]]'
OW="$(body /whatsapp "$OWNER")"
check "owner ve destinatarios, siempre enmascarados" '[[ "$OW" == *"+57 •••"* ]] && ! grep -qE "\+57 ?[0-9]{3}" <<<"$OW"'

echo "Resultado: $PASS ok, $FAILS fallos"
[[ $FAILS -eq 0 ]]
