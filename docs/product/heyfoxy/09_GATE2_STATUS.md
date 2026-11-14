# 09 — Gate 2: estado, infraestructura y plan

| Propiedad   | Valor                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| WO          | WO-MFOX-HEYFOXY-001, Gate 2 (aprobado con condiciones 2026-11-13)      |
| Rama        | `feat/heyfoxy-gate2-foundation` (estado actualizado 2026-11-14)        |
| Pruebas     | 54/54 unitarias, 111/111 de aislamiento SQL (re-ejecutadas 2026-11-13) |
| Costo       | USD 0 incremental a la fecha                                           |
| MediaFOX OS | Sin cambios (código, Vercel y Supabase)                                |

## 1. Vercel

**Causa raíz de la anomalía:** regla documentada de Vercel: el primer despliegue de un proyecto nuevo siempre es Production, aunque no se use `--prod`. El detalle está en el [WORKLOG](./WORKLOG.md).

**Configuración recomendada:**

| Entorno          | Configuración                                                                                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Production**   | Se mantiene el despliegue actual congelado, protegido y en modo demo (opción B). Sin variables de entorno de Production. Nadie promueve ni despliega con `--prod` sin GO independiente. Al llegar a Gate 3: Supabase Production propio, dominio y promoción explícita |
| **Preview (QA)** | Despliegues con CLI ≥ 65, sin `--prod` ni `--target`, con `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` explícitos (o `--project heyfoxy-web`). Variables de Preview apuntan solo a Supabase QA de Hey Foxy. Protección Vercel Authentication `all`                             |
| **Control**      | Tras cada despliegue: confirmar `target` = preview, que solo existe el alias de despliegue y que la URL sin sesión responde 302. Si algo no coincide: detener y reportar (HF-OPS-01)                                                                                  |
| **Git**          | No conectar hasta Gate 3 (HF-OPS-04)                                                                                                                                                                                                                                  |

## 2. Supabase: opciones y costos

Hechos verificados en la documentación de Supabase y en la cuenta:

- El plan Free permite 2 proyectos activos por persona y cuenta en **todas** las organizaciones donde es Owner o Admin. Por eso una organización Free nueva no resuelve el bloqueo.
- Pro cuesta USD 25 al mes por organización e incluye USD 10 de créditos de cómputo, que cubren un proyecto Micro. Cada proyecto Micro adicional cuesta unos USD 10 al mes, facturados por hora.
- Organización actual `alipise` (Free), con 2 proyectos activos (`mediafox-os`, `mediafox-os-qa`) y 3 pausados.

| Opción                                                          | Proyectos Hey Foxy | Costo estimado/mes | Aislamiento | Comentario                                                                                                                                                |
| --------------------------------------------------------------- | ------------------ | ------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Nueva org «Hey Foxy» en Pro, solo QA ahora** (recomendada) | QA                 | **≈ USD 25**       | Total       | Facturación separada de MediaFOX OS. Production se añade en Gate 3 por unos USD 10 más (total ≈ USD 35)                                                   |
| B. Nueva org Pro con QA y Production desde ya                   | QA + Prod          | ≈ USD 35           | Total       | Production sin uso hasta Gate 3: se paga antes de necesitarlo                                                                                             |
| C. Subir la org `alipise` actual a Pro                          | QA + Prod          | ≈ USD 55           | Débil       | Los 2 proyectos de MediaFOX OS empiezan a pagar cómputo y la facturación se mezcla. **No recomendada**                                                    |
| D. Seguir con Postgres local (actual)                           | —                  | USD 0              | Total       | Prueba RLS y esquema, pero no Auth de Supabase, ni la API real, ni la integración con Vercel. Bloquea Metricool y QA desplegado                           |
| E. Org Free cuyo Owner sea otra persona de MediaFOX             | QA                 | USD 0              | Total       | Depende de que esa persona tenga cupo Free. Los proyectos Free se pausan por inactividad y no tienen backups. Solo sirve para QA temporal; gobierno débil |

Los montos no incluyen excedentes de uso (almacenamiento o egress por encima de la cuota Pro), que no se esperan en QA. Antes de contratar, verificar el precio vigente en supabase.com/pricing.

## 3. Metricool

- Conector `lib/connectors/metricool.ts` implementado y **deshabilitado**: `HF_CONNECTOR_METRICOOL_ENABLED` ausente y sin credenciales en ningún entorno.
- Solo `GET`, con lista blanca cerrada de 8 rutas de lectura, cubierta por pruebas. Los endpoints de escritura, eliminación, campañas y administración de cuentas se rechazan antes de llegar a la red.
- Credenciales: **no solicitadas ni almacenadas.** El procedimiento está en [08 §3](./08_METRICOOL_CONNECTION.md) y se ejecuta solo con la autorización de la integración real.

## 4. Plan para completar Gate 2 (actualizado 2026-11-13, tras elegir la opción A)

| Paso | Acción                                                                                                                                                                       | Estado / requiere                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | CLI de Vercel 65.15.0 y script `apps/heyfoxy-web/scripts/deploy-preview.sh` (`check` / `verify` / `deploy`) con verificaciones de proyecto, directorio, entorno y protección | **Hecho**                                                 |
| 2    | Preview n.º 1, **solo modo demo** (sin variables): valida el procedimiento de punta a punta y confirma `target=preview` sin tocar Production                                 | **Hecho** (Preview n.º 1 `bb8b422`, n.º 2 `f1e5205`)      |
| 3    | Organización «Hey Foxy» Pro + `heyfoxy-qa` ([10 §2](./10_SUPABASE_QA_PROCEDURE.md))                                                                                          | **Hecho** (`admbpgqtgmaaofcgajzh`, verificado 2026-11-14) |
| 4    | 4 migraciones (0001–0004) solo en `heyfoxy-qa`, advisors y batería remota sin residuos ([10 §3–4.1](./10_SUPABASE_QA_PROCEDURE.md))                                          | Paso 3 + GO de migración en QA                            |
| 5    | Usuarios QA y seed sintético ([10 §4.2](./10_SUPABASE_QA_PROCEDURE.md))                                                                                                      | Paso 4                                                    |
| 6    | Variables de Preview (URL `plain` y clave publicable de QA) y Preview n.º 2 conectado a QA                                                                                   | Pasos 4–5 + GO de Preview                                 |
| 7    | Matriz funcional en Preview ([10 §4.3](./10_SUPABASE_QA_PROCEDURE.md)) e informe de cierre de Gate 2 con SHA                                                                 | Paso 6                                                    |
| 8    | (Opcional) Metricool, pasos 1–6 de [08 §3](./08_METRICOOL_CONNECTION.md)                                                                                                     | GO, autorización MedPlus y paso 4                         |

## 5. Resultados de pruebas (2026-11-13, sin servicios externos)

| Suite                                                               | Resultado                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Unitarias (vitest)                                                  | 54/54                                                                                                                                |
| Aislamiento SQL, PostgreSQL 16                                      | 111/111                                                                                                                              |
| Aislamiento SQL, PostgreSQL 17.11 (versión de Supabase QA)          | 111/111                                                                                                                              |
| Batería remota simulada en PG17 (transacción abortada)              | 111/111, **cero residuos**                                                                                                           |
| Seed QA en PG17 (×2, idempotente) + RLS por usuario                 | OK: viewer de la clínica ve solo la clínica; owner del banco solo el banco                                                           |
| Typecheck, lint y build de producción                               | OK (14 rutas)                                                                                                                        |
| Smoke HTTP del Command Center (`scripts/smoke-http.sh`)             | 32/32: auth, 11 vistas, cookie de empresa forjada, roles en WhatsApp, cabeceras de seguridad                                         |
| Script de Preview: pruebas negativas                                | 4/4 bloqueos: `--prod` rechazado, árbol sucio, `verify` detecta el target `production` del despliegue congelado, comando desconocido |
| Script de Preview: `check` completo (incluye `vercel deploy --dry`) | OK; ver el WORKLOG                                                                                                                   |

**Pendiente de QA real:** Auth de Supabase, `supabase-repository.ts` y la matriz funcional en Preview. Dependen de los pasos 3 a 7.
