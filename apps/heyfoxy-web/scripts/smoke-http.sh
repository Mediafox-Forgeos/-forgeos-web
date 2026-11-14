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
check "detalle muestra comentarios asociados" '[[ "$(body /publicaciones/demo-clinica-aurora-post-instagram "$OWNER")" == *"Comentarios asociados"* ]]'
check "reportes muestran resúmenes ejecutivos" '[[ "$(body /reportes "$OWNER")" == *"Resúmenes ejecutivos"* ]]'

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
