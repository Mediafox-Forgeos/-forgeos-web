# TECH-001 — Repository Integrity & Quality Gates

**Fecha:** 2026-07-22
**Rama de trabajo:** `chore/tech-001-repository-integrity` (creada a partir de `main` @ `d60742f`)
**Ejecutor:** VULCAN
**Origen:** WO-002, en respuesta a los riesgos críticos y altos identificados en WO-001 (Repository & Project Assessment, 2026-07-22)
**Alcance:** Integridad de `.git`, worktrees heredados, gestor de paquetes, y compuertas de calidad raíz (`lint`/`typecheck`/`test`/`build`). No incluye funcionalidad de producto, deploys, ni CAP-001.

---

## 1. Resumen ejecutivo

El repositorio en `/Volumes/MediaFOX_DEV/Repositories/Mediafox-ForgeOS` presentaba corrupción real en `.git/refs` y dos apps sin declarar `eslint` como dependencia propia, lo que rompía `pnpm lint` a nivel raíz. Ambos problemas quedaron resueltos. Durante el diagnóstico de seguridad (Fase 1) se encontraron dos worktrees heredados con trabajo no recuperado con certeza; **se preservaron intactos** por decisión explícita, en vez de asumir que eran descartables.

| Resultado | Estado |
|---|---|
| Refs corruptas eliminadas | ✅ 6/6 |
| Worktrees en riesgo preservados sin tocar | ✅ 2/2 |
| Worktree limpio desregistrado correctamente | ✅ 1/1 |
| `pnpm lint` desde cero | ✅ Pasa (11/11 proyectos con script) |
| `pnpm typecheck` desde cero, sin pasos secretos | ✅ Pasa (11/11 proyectos con script) |
| `pnpm test` | ✅ Pasa (35/35 en `movos-api`, único paquete con tests) |
| `pnpm build` | ✅ Pasa (5/5 apps) |
| Commits realizados | Sí, en rama separada, sin push ni merge |

---

## 2. Causa raíz de las referencias corruptas

`git fsck` reportó referencias con nombres inválidos (espacios, sufijos `" 2"`/`" 3"`) y un `.DS_Store` dentro de `.git/refs/`:

```
refs/.DS_Store                                   ← archivo de Finder, no un ref
refs/heads/main 2                                ← sha 000...0 (inválido)
refs/heads/main 3.lock                           ← lock residual de una operación interrumpida
refs/heads/worktree-agent-a2c3f54482cd94f17 2    ← sha 000...0 (inválido)
refs/remotes/origin/main 2                       ← sha 000...0 (inválido)
refs/remotes/origin/main 3                       ← sha 000...0 (inválido)
```

Se encontraron también archivos duplicados con el mismo patrón fuera de `refs/` (`.git/ORIG_HEAD 2`, `.git/index 2`, `.git/index 3`), y al intentar remover el worktree limpio, `git worktree remove` falló con:

```
fatal: validation failed, cannot remove working tree: '.../agent-af06c4c933f634184'
does not point back to '.git/worktrees/agent-af06c4c933f634184'
```

Inspección del `.git` interno del worktree confirmó que apuntaba al `.git/worktrees/...` de la ubicación **antigua** (`/Users/alipise/Documents/Mediafox-ForgeOS`), mientras el repositorio activo es la copia del SSD (`/Volumes/MediaFOX_DEV/Repositories/Mediafox-ForgeOS`).

**Conclusión:** el patrón `" 2"`/`" 3"` en nombres de archivo es la firma de una duplicación hecha por macOS Finder (copiar/pegar de la carpeta `.git`), no de un `git clone` o `git mv`. La migración del workspace al SSD se hizo copiando la carpeta completa por el sistema de archivos en lugar de un mecanismo de git, dejando **dos repositorios `.git` independientes que reclaman las mismas worktrees**.

---

## 3. Resolución aplicada

### 3.1 Backup previo a cualquier cambio

Creado antes de tocar cualquier ref, en `/Volumes/MediaFOX_DEV/Repositories/Mediafox-ForgeOS-backups/` (fuera de `.git`, mismo volumen SSD):

| Archivo | Contenido |
|---|---|
| `mediafox-forgeos-valid-refs-20260722-004306.bundle` | Bundle Git verificado (`git bundle verify` → OK) con las 6 refs válidas: `main`, `feat/location-capability`, las 3 ramas `worktree-agent-*`, `origin/main` |
| `dotgit-full-raw-20260722-004306.tar.gz` | Copia forense completa de `.git` (1.3 MB) previa a cualquier limpieza, incluyendo las refs corruptas |
| `git-refs-snapshot-20260722-004306.tar.gz` | Snapshot adicional de refs/HEAD/config/worktrees |

### 3.2 Refs eliminadas (exclusivamente las 6 listadas en §2)

Eliminadas como archivos sueltos (no había forma de usar `git update-ref -d` porque el nombre mismo es inválido para git — es el mecanismo estándar de recuperación para este tipo de corrupción). Ninguna rama legítima fue tocada; `git branch -a` y `git fsck` se verificaron antes y después de cada paso.

### 3.3 Worktrees — decisión y resultado

Los 3 worktrees heredados en `/Users/alipise/Documents/Mediafox-ForgeOS/.claude/worktrees/` se inspeccionaron individualmente antes de tocar nada:

| Worktree | HEAD | ¿Ancestro de `main`? | Working tree | Decisión |
|---|---|---|---|---|
| `agent-af06c4c933f634184` | `9ca3e85` | Sí | Limpio | **Removido** vía `git worktree remove` (tras `git worktree repair` para corregir el enlace `.git` roto descrito en §2) |
| `agent-a2c3f54482cd94f17` | `3708e2a` | **No** — commit exclusivo, no presente en ningún punto de la historia de `main` | Limpio (salvo un archivo basura de Finder, `package 2.json`, 1 línea de diferencia con `package.json`) | **Preservado intacto**, sin tocar |
| `agent-a1b5604a066f174e4` | `7508044` | Sí (el commit) | 15 archivos modificados + 5 rutas nuevas sin commitear — implementación completa pero distinta de la Location Capability ya mergeada en `main` (ADR-0007, `LocationModule`, `LocationPicker`, `SiteMap`, migración Prisma) | **Preservado intacto**, sin tocar |

`git worktree repair` corrigió el puntero `.git` de los 3 worktrees para que apunten al repositorio activo del SSD — esto es **solo un cambio de enlace**, no toca contenido, ramas ni commits. Se verificó explícitamente que HEAD y `git status` de los dos worktrees preservados no cambiaron antes/después del repair.

La rama `worktree-agent-af06c4c933f634184` **no fue borrada** — sigue existiendo como rama normal (`git branch --list` la muestra), solo dejó de estar registrada como worktree activo.

**Pendiente de decisión humana (no resuelto en este WO, por diseño):** qué hacer con el contenido de `agent-a2c3f54482cd94f17` (commit `3708e2a`) y `agent-a1b5604a066f174e4` (cambios sin commitear). Ambos tienen forma de borrador temprano de una feature que luego se reimplementó y sí llegó a `main` (evidencia: nombres de migración con timestamp placeholder vs. timestamp real de Prisma, texto de ADR sustancialmente distinto), pero esto no fue confirmado línea por línea. El bundle de respaldo (§3.1) los preserva independientemente de lo que se decida.

---

## 4. Estándar de migración futura (recomendación)

Para evitar que se repita este tipo de corrupción en una futura migración de workspace:

1. **Nunca copiar la carpeta `.git` con Finder/`cp -r`/Time Machine.** Usar `git clone <origen> <destino>` (si hay un remoto confiable) o `rsync -a --exclude=.git` para el working tree + `git bundle`/`git clone --mirror` para la historia.
2. Si el repositorio tiene worktrees activos, migrarlos explícitamente con `git worktree move` o recrearlos en el destino con `git worktree add`, nunca copiarlos como carpetas sueltas.
3. Después de cualquier migración de ubicación, correr `git worktree repair` y `git fsck --full` como parte del checklist de validación antes de reanudar trabajo.

---

## 5. Gestor de paquetes

`package-lock.json` (raíz) fue generado accidentalmente por un `npm install` ejecutado en algún punto dentro de este monorepo pnpm. No estaba rastreado por git, nada lo referenciaba (`package.json`, `pnpm-workspace.yaml`, `.gitignore`, `Dockerfile` no lo mencionan), y su contenido era un lockfile vacío (`lockfileVersion: 3`, sin dependencias). Se eliminó. Se confirmó por checksum que `package.json` y `pnpm-lock.yaml` no cambiaron.

**Gestor de paquetes oficial del monorepo: `pnpm@11.5.3`** (declarado en cada `package.json` vía `packageManager`). No usar `npm install` dentro de este repositorio.

---

## 6. Quality gates — causa raíz y corrección

### 6.1 `pnpm lint` roto en `forge-labs` y `naming-engine`

Ambas apps invocan `eslint` en su script `lint` pero no lo declaraban como `devDependency` propia — dependían de que pnpm lo resolviera desde otro paquete del workspace, lo cual no ocurre bajo el modo estricto de node_modules de pnpm. Corrección, alineada con las versiones ya usadas en `forgeos-web`/`movos-web`/`movos-api`:

- `apps/forge-labs/package.json`: agregado `eslint@^9.17.0`, `eslint-config-next@^15.5.2`, `@eslint/eslintrc@^3.3.6` (su `eslint.config.mjs` usa `FlatCompat` + presets de Next.js, igual que `forgeos-web`/`movos-web`, que sí tenían las tres declaradas).
- `apps/naming-engine/package.json`: agregado `eslint@^9.17.0` (su config no usa presets de Next.js, no necesita las otras dos).

No se modificó ninguna regla de lint.

### 6.2 `pnpm typecheck` fallaba en frío en `movos-api`

Causa: el cliente de Prisma nunca se generaba salvo como efecto colateral de `pnpm build` (`prisma generate && nest build`). Un `pnpm install` limpio seguido de `pnpm typecheck` producía 27 errores de tipos (`Module '"@prisma/client"' has no exported member 'Organization'...`) que parecen bugs de código pero son solo un cliente no generado.

**Decisión:** agregar `"postinstall": "prisma generate"` a `apps/movos-api/package.json`, en vez de modificar el script `build` (que se deja intacto y sigue siendo autosuficiente) o el `Dockerfile` (que ya invoca `prisma generate` explícitamente en su etapa `deps` y no depende de este hook).

Justificación de que es seguro:
- `prisma generate` solo lee el archivo `schema.prisma`; no requiere una conexión real a `DATABASE_URL` ni credenciales válidas — no hay efecto en producción ni necesidad de secretos en este paso.
- `pnpm-workspace.yaml` ya tiene `@prisma/client: true` y `prisma: true` en `allowBuilds`, mostrando que scripts de build de Prisma ya son confiables en este workspace.
- Se verificó explícitamente con una simulación de checkout limpio (`rm -rf apps/movos-api/node_modules && pnpm install`) que el hook se dispara correctamente y regenera el cliente sin intervención manual.
- El `Dockerfile` de producción no se modificó y sigue llamando `prisma generate` de forma explícita en su propia etapa — este cambio no altera el build de producción, solo mejora el bootstrap de desarrollo/CI.

### 6.3 Resultados de quality gates (post-fix, desde cero)

Ejecutado en orden desde la raíz tras `rm -rf apps/movos-api/node_modules && pnpm install` (checkout limpio simulado):

| Comando | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ OK |
| `pnpm lint` | ✅ Pasa — 5/5 apps con script de lint (`forgeos-web`, `forge-labs`, `movos-api`, `movos-web`, `naming-engine`) |
| `pnpm typecheck` | ✅ Pasa — 8/8 paquetes con script de typecheck (5 apps + `core-domain`, `shared-types`, `ui`), sin pasos manuales previos |
| `pnpm test` | ✅ Pasa — 35/35 tests, 4 suites, únicamente en `movos-api` (único paquete con script `test` definido; el resto no lo tiene — comportamiento esperado, no una falla) |
| `pnpm build` | ✅ Pasa — 5/5 apps compilan (`forgeos-web`, `forge-labs`, `movos-web` generan salida estática/SSR; `movos-api` corre `prisma generate && nest build`; `naming-engine` compila con `tsc`) |

Ningún comando faltó de forma inesperada. `packages/eslint-config`, `packages/naming-engine` y `packages/typescript-config` no declaran scripts — es el comportamiento esperado para paquetes de configuración/reexport puros, no una falla.

---

## 7. `PROJECT_INVENTORY.md`

Marcado como obsoleto en su propio encabezado (ver el archivo) en lugar de eliminado — preserva el snapshot histórico del commit `583ba8a` (2026-07-13), previo a la existencia de MOVOS. La fuente de verdad actual del estado del repositorio son `docs/audits/MOVOS_CURRENT_STATE_AUDIT.md`, `docs/audits/REPOSITORY_HEALTH_REPORT.md` y este documento.

---

## 8. Riesgos residuales (fuera del alcance de TECH-001)

- Los dos worktrees preservados (`agent-a2c3f54482cd94f17`, `agent-a1b5604a066f174e4`) siguen sin resolución — requieren revisión humana de su contenido antes de decidir si se descartan o se recuperan.
- La ubicación antigua (`/Users/alipise/Documents/Mediafox-ForgeOS`) sigue existiendo como un `.git` independiente y no fue tocada — sigue siendo una fuente potencial de confusión si alguien trabaja ahí por error.
- `git fsck` reporta varios `dangling commit`/`dangling tree` benignos — no se ejecutó `git gc` agresivo, según instrucción explícita del work order.
- 2 commits en `main` seguían sin pushear a `origin/main` al iniciar este WO; ese estado no fue modificado por TECH-001.
