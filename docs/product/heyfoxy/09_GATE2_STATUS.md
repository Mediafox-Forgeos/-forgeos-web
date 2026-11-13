# 09 — Gate 2: estado, infraestructura y plan

| Propiedad   | Valor                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| WO          | WO-MFOX-HEYFOXY-001, Gate 2 (aprobado con condiciones 2026-11-13)      |
| Rama        | `feat/heyfoxy-gate2-foundation` (código `fd896ad`)                     |
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

## 4. Plan para completar Gate 2

| Paso | Acción                                                                                                  | Requiere                         |
| ---- | ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1    | Actualizar la CLI de Vercel y crear el script de Preview con verificaciones (HF-OPS-01). Sin ejecutarlo | —                                |
| 2    | Crear la org y el proyecto Supabase QA de Hey Foxy                                                      | **Aprobación de costo (opción)** |
| 3    | Aplicar las 3 migraciones solo en QA de Hey Foxy, más la batería de aislamiento contra QA real          | Paso 2                           |
| 4    | Validar Auth y `supabase-repository` en QA: usuarios de prueba, cambio de empresa y roles               | Paso 3                           |
| 5    | Primer Preview real con variables de QA, verificación de `target` y protección                          | **GO de despliegue Preview**     |
| 6    | QA funcional en Preview (flujos, aislamiento HTTP, móvil). Informe de cierre de Gate 2 con SHA          | Paso 5                           |
| 7    | (Opcional, Gate 2 tardío) Metricool, pasos 1–6 de 08 §3                                                 | GO, autorización MedPlus, paso 3 |
