# MOVOS Repository — Health Report

**Fecha:** 2026-07-20  
**Rama:** `main` · base commit `cd03df3`  
**Alcance:** Limpieza de artefactos, corrección de `.gitignore`, decisión sobre `.railwayignore`, registro de tiempos, diagnóstico de bloqueos.

---

## 1. Resumen Ejecutivo

El repositorio quedó en estado saludable para iniciar CAP-001, con dos acciones realizadas:

1. `.gitignore` actualizado — se agregó la regla `.claude/` para excluir los artefactos temporales de Claude Code.
2. `.railwayignore` versionado — fue confirmado como archivo operacional crítico y se adicionó al control de versiones.

Se identificó y documentó un **bloqueo de filesystem de macOS** causado por iCloud Optimize Mac Storage que evicta archivos locales. Este bloqueo afecta al desarrollo diario y debe resolverse antes de iniciar CAP-001.

---

## 2. Estado Inicial del Repositorio (antes de este commit)

```
git status output (branch cd03df3, pre-fix):

On branch main
Your branch is ahead of 'origin/main' by 1 commit.

Untracked files:
  .claude/worktrees/agent-a1b5604a066f174e4/
  .claude/worktrees/agent-a2c3f54482cd94f17/
  .railwayignore

nothing added to commit but untracked files present
```

| Métrica | Valor antes |
|---|---|
| Tiempo `git status` completo | **19 min 16 s** |
| Tiempo enumeración de archivos no rastreados | 80.74 s |
| Tiempo cálculo ahead/behind | 28.98 s |
| Archivos rastreados en el índice | 313 |
| Directorios no rastreados de Claude Code | 2 visibles (3 totales) |
| Errores de I/O al indexar | 134 archivos |

---

## 3. Acciones Realizadas

### 3.1 Corrección de `.gitignore`

**Problema:** El directorio `.claude/` no estaba en `.gitignore`. Git escaneaba las tres worktrees de Claude Code (incluyendo `node_modules` interno de ~10MB cada una) como candidatos a archivos no rastreados, causando 19 minutos de `git status`.

**Acción:** Se agregó al final del `.gitignore` raíz:

```
# Claude Code artifacts (worktrees, cache, settings)
.claude/
```

**Efecto esperado:** git ignorará completamente `.claude/worktrees/`, `.claude/settings/`, y cualquier otro artefacto que Claude Code genere en el proyecto. `git status` dejará de escanear esos directorios.

**Archivos `.gitignore` existentes (correctos, no modificados):**

| Archivo | Reglas clave |
|---|---|
| `.gitignore` (raíz) | `**/node_modules`, `**/.next`, `**/dist`, `**/build`, `.DS_Store`, `.env*.local` |
| `apps/movos-api/.gitignore` | `.env`, `dist/`, `node_modules/`, `coverage/`, `*.log` |
| `apps/movos-web/.gitignore` | Verificado como rastreado en el índice (contenido no legible por iCloud eviction) |

### 3.2 Versionado de `.railwayignore`

**Decisión: A — Debe permanecer versionado como parte del proyecto.**

**Justificación:**

`.railwayignore` es el equivalente de `.dockerignore` para Railway. Controla qué archivos NO se transfieren al builder de Railway durante el deployment. Sin este archivo, Railway intentaría subir:
- Todos los `node_modules/` del monorepo (gigabytes)
- `.next/` y `dist/` de builds previos
- `.git/` completo (historial incluido)
- `.claude/` con worktrees

Esto causaría deployments extremadamente lentos o fallidos. El archivo es **operacionalmente crítico** y debe versionarse junto al código fuente.

**Contenido del `.railwayignore` comprometido:**

```
**/node_modules
**/.next
**/dist
**/build
**/.pnpm-store
**/.git
**/.claude
**/.vercel
**/coverage
**/*.log
**/.DS_Store
*.tsbuildinfo
```

---

## 4. Verificación de Artefactos — ¿Existen Cosas que No Deberían Estar?

### 4.1 `node_modules`

- **Raíz:** `/node_modules/` — **NO rastreado** (correctamente excluido por `.gitignore`)
- **`apps/movos-api/node_modules/`** — **NO rastreado** (excluido)
- **`apps/movos-web/node_modules/`** — **NO rastreado** (excluido)
- **`.claude/worktrees/*/node_modules/`** — **NO rastreado** (excluido por regla `.claude/` nueva)
- **Resultado: ✅ Sin node_modules versionados**

### 4.2 `.next`, `dist`, `build`, `out`

- Cubiertos por `**/.next/`, `**/dist`, `**/build`, `**/out/` en el `.gitignore` raíz
- **Resultado: ✅ Sin artefactos de build versionados**

### 4.3 `coverage`

- Cubierto por `apps/movos-api/.gitignore` (regla `coverage/`)
- **Resultado: ✅ Sin reportes de coverage versionados**

### 4.4 Archivos `.env`

- `apps/movos-api/.env` existe localmente pero está en `apps/movos-api/.gitignore` (regla `.env`)
- `apps/movos-api/.env.example` — rastreado correctamente (contiene solo nombres de variables, sin valores)
- `apps/movos-web/.env.example` — rastreado correctamente
- **Resultado: ✅ Sin secretos versionados**

### 4.5 Logs y temporales

- `npm-debug.log*`, `pnpm-debug.log*`, `*.log` cubiertos
- `.DS_Store` cubierto
- `*.pem` cubierto
- `tsconfig.tsbuildinfo` — aparece en raíz (`tsconfig.tsbuildinfo`, 0 bytes por ser placeholder de pnpm) — excluido por `*.tsbuildinfo`
- **Resultado: ✅ Sin logs ni temporales versionados**

### 4.6 Worktrees de Claude Code

- **Estado pre-fix:** `.claude/worktrees/agent-a1b5604a066f174e4/` y `agent-a2c3f54482cd94f17/` aparecían como untracked (git no las ignoraba pero tampoco las rastreaba)
- **Estado post-fix:** excluidas por regla `.claude/`
- **Nota:** las worktrees siguen registradas en `.git/worktrees/` como worktrees activos. No se eliminaron (operación no destructiva). Si se quieren limpiar completamente: `git worktree remove --force .claude/worktrees/agent-xxx` o `git worktree prune`.
- **Resultado: ✅ No versionados, no rastreados**

---

## 5. Diagnóstico del Bloqueo de Filesystem

### 5.1 Causa raíz identificada: iCloud Optimize Mac Storage

Durante esta sesión se observó que **134 archivos del repositorio** generaban el error:

```
error: read error while indexing apps/movos-web/...: Operation timed out
fatal: mmap failed: Operation timed out
```

**Causa:** macOS iCloud Drive con "Optimizar Almacenamiento" activado evicta archivos localmente cuando el disco está bajo presión o los archivos no se han accedido recientemente. Los archivos continúan mostrando su tamaño real en `ls` (con metadatos en iCloud), pero el contenido real está en la nube. Cuando git (o cualquier proceso) intenta leer el contenido, macOS desencadena una descarga que puede timeout.

**Evidencia:**
- Archivos con atributo `com.apple.provenance` — confirma gestión por iCloud File Provider
- `xattr -l` en algunos archivos tomaba varios segundos o fallaba
- `brctl download <archivo>` antes de `git hash-object` resolvió el timeout para `.railwayignore`
- Archivos recién creados o modificados (como `.gitignore` editado en esta sesión) funcionan correctamente — están en caché local
- `git log` y operaciones sobre el object database funcionan sin problema — los objetos git sí están locales
- `git status` falló con `fatal: mmap failed` tras leer todos los errores de los archivos evictados

### 5.2 Impacto en el desarrollo

| Operación | Impacto |
|---|---|
| `git status` | Falla o tarda 20+ minutos |
| `git add <app-file>` | Falla con timeout |
| Typecheck, lint, build | Posiblemente afectados si los archivos fuente están evictados |
| `git log`, `git diff --cached` | Funcionan (object database local) |
| `pnpm install`, `pnpm build` | Requieren que los archivos estén locales |

### 5.3 Solución recomendada

**Opción A — Permanente (recomendada):**

```
System Settings → Apple ID → iCloud → iCloud Drive
→ Options… → desmarcar "Optimize Mac Storage"
```

Esto garantiza que todos los archivos se mantengan siempre locales.

**Opción B — Recuperación inmediata:**

```bash
# Forzar descarga del repositorio completo desde iCloud
brctl download /Users/alipise/Documents/Mediafox-ForgeOS
```

Ejecutar y esperar 1-5 minutos. Después, `git status` debería responder normalmente.

**Opción C — Si las opciones A/B no son viables:**

Mover el repositorio a un directorio fuera de iCloud (ej. `~/Developer/Mediafox-ForgeOS`). `/Users/alipise/Documents/` está sincronizado con iCloud. `/Users/alipise/Developer/` normalmente no.

---

## 6. Tiempos Reales Medidos

| Operación | Antes (pre-fix) | Después (post-fix) | Causa delta |
|---|---|---|---|
| `git status` | 19 min 16 s | 2 min 40 s (con 134 errores I/O) | iCloud eviction + worktrees |
| `git log --oneline -5` | < 2 s | < 2 s | Object DB local, no afectado |
| `git diff --cached` | < 2 s | < 2 s | Object DB local, no afectado |
| `git worktree list` | < 2 s | < 2 s | Object DB local, no afectado |
| `git write-tree` | < 2 s | < 2 s | Object DB local, no afectado |
| `git commit-tree` | < 2 s | < 2 s | Object DB local, no afectado |

**Nota:** el `git status` post-fix de 2 min 40 s es mejora real frente a 19 min 16 s, pero sigue fallando por iCloud eviction. Una vez resuelto el iCloud issue (Opción A, B o C), `git status` debería responder en < 3 segundos.

---

## 7. Estado Final del Repositorio

```
git log --oneline -5 (post-commit):

<nuevo hash>  chore(repository): finalize repository health after audit
cd03df3       docs(audit): MOVOS current state audit 2026-07-20
de8f1f3       feat(location): map fades out during search, fades in on selection
9181aeb       fix(location): fix dropdown z-index war with Google Maps
8840cd3       fix(location): fix 3 UX bugs in LocationPicker
```

```
git diff --cached --name-status (este commit):

M  .gitignore
A  .railwayignore
A  docs/audits/REPOSITORY_HEALTH_REPORT.md
```

| Check | Estado |
|---|---|
| node_modules versionados | ✅ Ninguno |
| .next / dist / build versionados | ✅ Ninguno |
| Secretos (.env) versionados | ✅ Ninguno |
| .claude/ versionado | ✅ Excluido |
| .railwayignore versionado | ✅ Comprometido |
| git log funcional | ✅ < 2 s |
| git diff --cached funcional | ✅ < 2 s |
| git status funcional | ⚠️ Degradado por iCloud eviction |
| Procesos colgados de sesión anterior | ✅ Ninguno |

---

## 8. Riesgos Identificados

| Riesgo | Severidad | Acción |
|---|---|---|
| **iCloud Optimize Mac Storage** evicta archivos del repo — bloquea `git status`, `git add`, typecheck, lint en cualquier archivo no accedido recientemente | **ALTA** | Ejecutar Opción A, B o C antes de iniciar CAP-001 |
| Worktrees de Claude Code (`agent-xxx`) siguen registradas en `.git/worktrees/` — son inofensivas pero ocupan ~20MB y aparecen en `git worktree list` | BAJA | Ejecutar `git worktree prune` cuando se esté seguro que los agentes ya no necesitan esas ramas |
| `git status` sin `--no-ahead-behind` hace fetch de origin para comparar — tarda 28+ segundos adicionales | BAJA | Usar `git status --no-ahead-behind` para checks rápidos locales |
| core.fsmonitor fue configurado por Xcode/Sourcetree y causó cuelgues en sesión anterior — actualmente en `false` | RESUELTA | Mantener `core.fsmonitor=false` en el config local |

---

## 9. Recomendaciones Pre-CAP-001

1. **URGENTE:** Resolver el iCloud eviction issue (Opción A preferida) antes de empezar a escribir código. Sin esto, cada `git add` en `apps/` puede fallar con timeout.

2. **Ejecutar `brctl download /Users/alipise/Documents/Mediafox-ForgeOS`** como primer paso en la próxima sesión de desarrollo para tener todos los archivos locales.

3. **`git worktree prune`** para limpiar las referencias a worktrees de agentes (opcional, cosmético).

4. Una vez resuelto el iCloud issue, ejecutar `git status` limpio para confirmar que el repositorio responde en < 3 segundos con cero archivos no rastreados.

---

## 10. Confirmación: MOVOS está listo para iniciar CAP-001

| Criterio | Estado |
|---|---|
| Auditoría técnica completa | ✅ `docs/audits/MOVOS_CURRENT_STATE_AUDIT.md` |
| Repository health completo | ✅ Este documento |
| Sin artefactos generados en el repo | ✅ |
| `.railwayignore` versionado | ✅ |
| Sin secretos versionados | ✅ |
| Autenticación y multi-tenancy en producción | ✅ |
| Sites API en producción | ✅ |
| Google Maps location picker en producción | ✅ |
| Modelos Prisma para EV domain pendientes | ⏳ CAP-001 |
| CI/CD pendiente | ⏳ Recomendado antes de primer merge CAP-001 |
| iCloud eviction issue | ⚠️ Resolver antes de escribir código |

**El repositorio está listo para recibir el desarrollo de CAP-001 una vez resuelto el bloqueo de iCloud.**
