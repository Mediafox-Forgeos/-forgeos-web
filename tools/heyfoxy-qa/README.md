# Hey Foxy QA — visual, accesibilidad y funcional (WO-HF-V2-00)

Pruebas de Playwright + axe sobre `apps/heyfoxy-web` **en modo demo** (datos sintéticos en memoria). Solo local: no apunta a Supabase QA, a Previews ni a Production, y no se despliega.

## Por qué vive aquí y no en `apps/heyfoxy-web`

`@playwright/test` es un peer opcional de `next`. Instalado dentro del workspace pnpm, cambia la entrada de `next` de **todas** las apps (MediaFOX OS, MOVOS) en el `pnpm-lock.yaml` raíz y las hace instalar Playwright. Este paquete está **fuera del workspace** (`tools/*` no está en `pnpm-workspace.yaml`), con lockfile propio y `.npmrc` con `ignore-workspace=true`.

## Uso

```bash
# 1. Instalar (una vez). Usa el store pnpm existente del volumen.
cd tools/heyfoxy-qa
pnpm install --ignore-workspace --store-dir /Volumes/MediaFOX_DEV/.pnpm-store

# 2. Build de heyfoxy-web en modo demo (sin variables de Supabase)
cd ../../apps/heyfoxy-web
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  sh -c 'node_modules/.bin/next build && node scripts/check-trace.mjs'

# 3. Verificar contra la línea base
cd ../../tools/heyfoxy-qa
node_modules/.bin/playwright test            # 48 pruebas: 16 vistas × 3 viewports
node_modules/.bin/playwright show-report     # informe HTML con diferencias visuales

# Regrabar capturas y deuda tras un cambio visual INTENCIONADO (revisar el diff antes de versionar)
HF_QA_RECORD=1 node_modules/.bin/playwright test --update-snapshots
```

Se invocan los binarios directamente: `pnpm run` dentro del monorepo dispara la verificación de dependencias de todo el workspace (HF-OPS-10).

**Requisitos:** Google Chrome instalado (se usa `channel: 'chrome'`; no se descargan navegadores) y permiso para abrir un puerto local (`127.0.0.1:3198`). En el sandbox de Claude Code hace falta `sandbox.network.allowLocalBinding: true`.

## Qué comprueba cada prueba (`e2e/baseline.spec.ts`)

1. **Funcional:** HTTP 200, sin errores de consola ni excepciones, sin respuestas 4xx/5xx, un `<h1>` visible.
2. **Accesibilidad:** axe con WCAG 2.0/2.1/2.2 A y AA. Falla si aparece una violación `serious` o `critical` que no está en `baseline/known-debt.json`.
3. **Desbordamiento horizontal:** falla si aparece uno nuevo.
4. **Visual:** captura de página completa comparada con `baseline/screenshots/<viewport>/<vista>.png` (tolerancia 0,2 % de píxeles).

## Estabilidad

- `support/fixed-clock.cjs` se precarga **solo** en el servidor de QA (`NODE_OPTIONS=--require`) y fija el reloj en `2026-11-14T15:00Z` (avanza en tiempo real desde ahí). Los datos demo son relativos a `Date.now()`; sin esto las capturas cambiarían cada día.
- Zona horaria y locale fijos (`America/Bogota`, `es-CO`), animaciones desactivadas, `reducedMotion`.
- Las capturas dependen de la versión de Chrome del sistema y de macOS: si Chrome se actualiza y cambian solo por antialiasing, regrabar y anotarlo en el WORKLOG.

## Autenticación

Cookies del modo demo (`hf_demo_user=demo-user-owner`, `hf_org` = Clínica Aurora). Nunca se leen contraseñas ni el llavero.
