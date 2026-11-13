#!/usr/bin/env bash
# Hey Foxy — despliegue Preview controlado (WO-MFOX-HEYFOXY-001, HF-OPS-01).
#
# Uso (desde cualquier directorio):
#   scripts/deploy-preview.sh check           Verificaciones previas + `vercel deploy --dry`. No sube nada.
#   scripts/deploy-preview.sh verify <url|id>  Verificación posterior de un despliegue. Solo lectura.
#   HF_PREVIEW_GO=<sha-corto-HEAD> scripts/deploy-preview.sh deploy
#                                             Despliegue Preview. Exige autorización ligada al SHA exacto.
#
# Garantías:
#   - Nunca Production: no acepta argumentos libres, fija --environment preview y comprueba el target.
#   - Proyecto fijado por ID (heyfoxy-web). Ignora el enlace .vercel/ de la raíz (apunta a MOVOS).
#   - Nunca imprime valores de variables de entorno, solo nombres y entornos.
#   - Ante cualquier discrepancia: se detiene con código ≠ 0 y NO intenta corregir ni borrar nada.
set -euo pipefail

readonly TEAM_ID="team_mDxi6jbhsvtFbOZow1DsYjzp"
readonly TEAM_SLUG="mediafox"
readonly PROJECT_ID="prj_N06kC9zUAiAELGJNqM9fDQJNfJyy"
readonly PROJECT_NAME="heyfoxy-web"
readonly ROOT_DIRECTORY="apps/heyfoxy-web"
readonly APP_PACKAGE="@mediafox/heyfoxy-web"
readonly MIN_CLI_MAJOR=65
# Despliegue de Production congelado (opción B, 2026-11-13). Debe seguir siendo el actual.
readonly FROZEN_PRODUCTION_DEPLOYMENT="dpl_CBLq2U37Axe66pHJakrqjCjyf8me"
readonly PRODUCTION_ALIASES="heyfoxy-web.vercel.app heyfoxy-web-mediafox.vercel.app"
# Proyectos Supabase de MediaFOX OS: Hey Foxy nunca puede apuntar a ellos.
readonly FORBIDDEN_SUPABASE_REFS="srsllmqeljhodttqefih wzamylhiqvosbrlhzssp"

export VERCEL_ORG_ID="$TEAM_ID"
export VERCEL_PROJECT_ID="$PROJECT_ID"
export VERCEL_TELEMETRY_DISABLED=1

ok() { printf '  ok   %s\n' "$1" >&2; }
fail() {
  printf '  FAIL %s\n' "$1" >&2
  printf '\nANOMALÍA: detener y reportar. No se realizaron acciones correctivas.\n' >&2
  exit 1
}
warn() { printf '  WARN %s\n' "$1" >&2; }

api() { vercel api "$1" --raw 2>/dev/null; }
# Extrae un valor de JSON por stdin con una expresión Python sobre `d`.
jget() { python3 -I -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

repo_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
  [[ -f "$here/$ROOT_DIRECTORY/package.json" ]] || fail "no se encontró $ROOT_DIRECTORY desde el script"
  echo "$here"
}

preflight() {
  local root sha branch
  root="$(repo_root)"
  cd "$root"
  echo "Preflight — $(date -u +%FT%TZ)" >&2

  # 1. Directorio y paquete
  [[ "$(git rev-parse --show-toplevel)" == "$root" ]] || fail "la raíz no es el toplevel git"
  [[ "$(python3 -I -c "import json;print(json.load(open('$ROOT_DIRECTORY/package.json'))['name'])")" == "$APP_PACKAGE" ]] \
    || fail "paquete inesperado en $ROOT_DIRECTORY"
  ok "directorio: $root (monorepo), app $ROOT_DIRECTORY"

  # 2. CLI
  local ver major
  ver="$(vercel --version 2>/dev/null | tail -1)"
  major="${ver%%.*}"
  [[ "$major" =~ ^[0-9]+$ && "$major" -ge "$MIN_CLI_MAJOR" ]] || fail "Vercel CLI $ver < $MIN_CLI_MAJOR"
  ok "Vercel CLI $ver"

  # 3. Git
  branch="$(git branch --show-current)"
  [[ -n "$branch" && "$branch" != "main" ]] || fail "rama '$branch' no permitida (main o HEAD separado)"
  [[ -z "$(git status --porcelain)" ]] || fail "árbol de trabajo con cambios sin commit"
  git fetch -q origin "$branch" || fail "no se pudo consultar origin/$branch"
  sha="$(git rev-parse HEAD)"
  git merge-base --is-ancestor "$sha" "origin/$branch" || fail "HEAD $sha no está publicado en origin/$branch"
  ok "git: rama $branch, árbol limpio, HEAD ${sha:0:7} publicado"

  # 4. Proyecto Vercel
  local proj
  proj="$(api "/v9/projects/$PROJECT_ID?teamId=$TEAM_ID")" || fail "no se pudo leer el proyecto"
  [[ "$(jget "d.get('name')" <<<"$proj")" == "$PROJECT_NAME" ]] || fail "nombre de proyecto inesperado"
  [[ "$(jget "d.get('accountId')" <<<"$proj")" == "$TEAM_ID" ]] || fail "equipo inesperado"
  [[ "$(jget "d.get('rootDirectory')" <<<"$proj")" == "$ROOT_DIRECTORY" ]] || fail "Root Directory distinto de $ROOT_DIRECTORY"
  [[ "$(jget "(d.get('ssoProtection') or {}).get('deploymentType')" <<<"$proj")" == "all" ]] \
    || fail "Deployment Protection no cubre todos los despliegues"
  [[ "$(jget "d.get('link') is None" <<<"$proj")" == "True" ]] || fail "Git integration conectada (no autorizada hasta Gate 3)"
  [[ "$(jget "((d.get('targets') or {}).get('production') or {}).get('id')" <<<"$proj")" == "$FROZEN_PRODUCTION_DEPLOYMENT" ]] \
    || fail "el despliegue de Production ya no es el congelado"
  ok "proyecto $PROJECT_NAME ($PROJECT_ID), root $ROOT_DIRECTORY, protección all, sin Git, Production congelado"

  # 5. Variables de entorno (solo nombres y entornos; nunca valores)
  local envs
  envs="$(api "/v10/projects/$PROJECT_ID/env?teamId=$TEAM_ID")" || fail "no se pudieron listar variables"
  HF_ENVS_JSON="$envs" python3 -I - "$FORBIDDEN_SUPABASE_REFS" >&2 <<'PY' || fail "configuración de variables no válida (ver arriba)"
import json, os, sys
forbidden = sys.argv[1].split()
envs = json.loads(os.environ["HF_ENVS_JSON"]).get("envs", [])
bad = False
for e in envs:
    targets = e.get("target") or []
    targets = [targets] if isinstance(targets, str) else targets
    print(f"         var {e.get('key')} -> {','.join(targets) or e.get('customEnvironmentIds')} ({e.get('type')})")
    if "production" in targets:
        print(f"  FAIL {e.get('key')}: variables de Production no autorizadas")
        bad = True
    val = e.get("value") if e.get("type") == "plain" else None
    if val and any(ref in val for ref in forbidden):
        print(f"  FAIL {e.get('key')}: apunta a un proyecto Supabase de MediaFOX OS")
        bad = True
keys = {e.get("key") for e in envs if "preview" in (e.get("target") or [])}
need = {"NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"}
if not need & keys:
    print("  WARN sin variables Supabase en Preview: el despliegue sería solo modo demo")
elif not need <= keys:
    print(f"  FAIL faltan variables Supabase en Preview: {sorted(need - keys)}")
    bad = True
url = next((e for e in envs if e.get("key") == "NEXT_PUBLIC_SUPABASE_URL"), None)
if url and url.get("type") != "plain":
    print("  WARN NEXT_PUBLIC_SUPABASE_URL no es 'plain': no se puede verificar que no apunte a MediaFOX OS")
sys.exit(1 if bad else 0)
PY
  ok "variables: sin Production, sin referencias a Supabase de MediaFOX OS"

  echo "${sha}"
}

verify() {
  local target="$1" expected_sha="${2:-}" dep id tgt url
  echo "Verificación posterior — $target"
  dep="$(api "/v13/deployments/${target#https://}?teamId=$TEAM_ID")" || fail "no se pudo leer el despliegue"
  id="$(jget "d.get('id')" <<<"$dep")"
  url="$(jget "d.get('url')" <<<"$dep")"
  [[ "$(jget "d.get('projectId')" <<<"$dep")" == "$PROJECT_ID" ]] || fail "$id pertenece a otro proyecto"
  tgt="$(jget "d.get('target')" <<<"$dep")"
  [[ "$tgt" == "None" || "$tgt" == "preview" ]] || fail "$id tiene target '$tgt' (se esperaba preview)"
  ok "$id target=preview, proyecto $PROJECT_NAME"
  if [[ -n "$expected_sha" ]]; then
    [[ "$(jget "(d.get('meta') or {}).get('githubCommitSha')" <<<"$dep")" == "$expected_sha" ]] || fail "SHA del despliegue distinto de HEAD"
    ok "SHA ${expected_sha:0:7}"
  fi
  local aliases a
  aliases="$(jget "' '.join(d.get('alias') or [])" <<<"$dep")"
  for a in $PRODUCTION_ALIASES; do
    [[ " $aliases " != *" $a "* ]] || fail "$id recibió el alias de Production $a"
  done
  ok "sin alias de Production"
  [[ "$(api "/v9/projects/$PROJECT_ID?teamId=$TEAM_ID" | jget "((d.get('targets') or {}).get('production') or {}).get('id')")" == "$FROZEN_PRODUCTION_DEPLOYMENT" ]] \
    || fail "Production dejó de apuntar al despliegue congelado"
  ok "Production sigue en $FROZEN_PRODUCTION_DEPLOYMENT"
  local path code loc
  for path in / /api/health /login; do
    read -r code loc < <(curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://$url$path")
    [[ ( "$code" == "302" && "$loc" == https://vercel.com/sso-api* ) || "$code" == "401" ]] \
      || fail "acceso anónimo a $path devolvió $code (se esperaba 302 a SSO o 401)"
  done
  ok "acceso anónimo bloqueado por Vercel Authentication (/, /api/health, /login)"
  echo "VERIFICADO: https://$url"
}

cmd="${1:-}"
case "$cmd" in
  check)
    [[ $# -eq 1 ]] || fail "check no acepta argumentos"
    preflight >/dev/null
    echo "Dry run (sin subir archivos):"
    (cd "$(repo_root)" && vercel deploy --dry --environment preview --project "$PROJECT_ID" --scope "$TEAM_SLUG" --yes >/dev/null 2>&1) \
      || fail "vercel deploy --dry falló"
    ok "vercel deploy --dry --environment preview"
    echo "CHECK OK — listo para solicitar autorización (HF_PREVIEW_GO=<sha>)."
    ;;
  verify)
    [[ $# -eq 2 ]] || fail "uso: verify <url|id>"
    verify "$2"
    ;;
  deploy)
    [[ $# -eq 1 ]] || fail "deploy no acepta argumentos (no se admite --prod ni otras opciones)"
    sha="$(preflight)"
    [[ -n "${HF_PREVIEW_GO:-}" && "$sha" == "${HF_PREVIEW_GO}"* && ${#HF_PREVIEW_GO} -ge 7 ]] \
      || fail "falta autorización: HF_PREVIEW_GO debe ser el SHA (≥7) de HEAD ${sha:0:7}"
    ok "autorización ligada a ${sha:0:7}"
    out="$(cd "$(repo_root)" && vercel deploy --environment preview --project "$PROJECT_ID" --scope "$TEAM_SLUG" \
      --yes --json --build-env "HF_BUILD_SHA=$sha" --env "HF_BUILD_SHA=$sha" 2>/dev/null)" || fail "vercel deploy falló"
    dep_url="$(python3 -I -c "import json,sys; d=json.load(sys.stdin); d=d.get('deployment',d); print(d.get('url'))" <<<"$out")"
    [[ -n "$dep_url" && "$dep_url" != "None" ]] || fail "no se obtuvo la URL del despliegue"
    verify "$dep_url" "$sha"
    ;;
  *)
    echo "uso: $0 check | verify <url|id> | deploy (con HF_PREVIEW_GO=<sha>)" >&2
    exit 2
    ;;
esac
