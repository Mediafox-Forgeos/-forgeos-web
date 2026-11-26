# Hey Foxy — WORKLOG (WO-MFOX-HEYFOXY-001)

Registro cronológico de ejecución, decisiones y anomalías. Sin secretos ni credenciales.

## 2026-11-12 — Gate 1

- Propuesta de arquitectura y MVP entregada (documentos 01–07).
- Resultado: **GATE 1 APROBADO CON CONDICIONES** (decisiones 1–7, requisitos A–J).

## 2026-11-13 — Gate 2: fundación

- Rama `feat/heyfoxy-gate2-foundation` en ForgeOS. Commits `a0c2e56` (fundación) y `fd896ad` (ajuste de tipos en una prueba). Sin PR ni fusión a `main`.
- `apps/heyfoxy-web` (Next 15, independiente de MediaFOX OS):
  - 3 migraciones de esquema dev/QA con RLS multiempresa en las 26 tablas _(corregido el 2026-11-14: decía 28 por un error de recuento; ver [11](./11_SCHEMA_INVENTORY.md) §1)_;
  - contratos de conectores;
  - Model Router de IA;
  - incidentes con máquina de estados;
  - WhatsApp en modo simulación;
  - Command Center de 11 vistas con modo demo identificado.
- Pruebas:
  - 54/54 unitarias;
  - 111/111 de aislamiento SQL sobre Postgres 16 local efímero;
  - QA en navegador local;
  - pruebas HTTP con cookies de empresa manipuladas;
  - móvil a 390 y 820 px sin desbordes.
- **Bloqueo Supabase:** la organización `alipise` está en plan Free y ya tiene 2 proyectos activos (`mediafox-os`, `mediafox-os-qa`). No se creó ningún proyecto; ver la sección «Supabase» de [09_GATE2_STATUS.md](./09_GATE2_STATUS.md).

## 2026-11-13 — Actualización: Metricool Advanced contratado

- Álvaro confirma que Metricool Advanced está contratado y activo. Pasa a ser la primera fuente del piloto, sin cambiar prioridades ni crear nueva WO.
- Capacidades reales verificadas contra la especificación OpenAPI oficial; procedimiento de conexión segura en [08_METRICOOL_CONNECTION.md](./08_METRICOOL_CONNECTION.md).
- Hallazgo: la API expone acciones con efecto real vía `GET` (borrar comentarios, campañas pagadas, seguir cuentas, eliminar marcas). Mitigación: lista blanca de 8 rutas de lectura, con pruebas.

## 2026-11-13 06:17 UTC — ANOMALÍA: despliegue de QA registrado como Production

- Proyecto Vercel nuevo `heyfoxy-web` (`prj_N06kC9zUAiAELGJNqM9fDQJNfJyy`, equipo mediafox).
- Comando: `vercel deploy --yes --target=preview` con CLI 56.2.0, desde la raíz del monorepo y con `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` explícitos.
- Resultado: `dpl_CBLq2U37Axe66pHJakrqjCjyf8me`, `target: production`, SHA `fd896ad`, `source: cli`.
  - Alias: `heyfoxy-web.vercel.app` y `heyfoxy-web-mediafox.vercel.app`.
- Ejecución detenida y reportada.
- **Decisión de Álvaro: opción B temporal.** Se mantiene el despliegue protegido, sin eliminarlo ni promoverlo, y sin nuevos despliegues hasta presentar el diagnóstico.

### Diagnóstico (2026-11-13, solo lectura)

| Verificación                     | Resultado                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Causa raíz                       | Comportamiento documentado de Vercel: «The first deployment of a new project is always a production deployment, even without --prod»                                                       |
| Evidencia complementaria         | La propia CLI respondió «`vercel deploy --prod` → Promote to production»: creía haber creado un Preview. El servidor lo asignó a Production por ser el primer despliegue                   |
| Despliegues del proyecto         | 1 (este). No hay otros                                                                                                                                                                     |
| Git integration                  | **No conectada** (sin `link`). Por tanto no hay Production Branch y no hay despliegues automáticos                                                                                         |
| Entornos personalizados          | 0 (límite de la cuenta: 0)                                                                                                                                                                 |
| Deployment Protection            | Vercel Authentication `all` (Preview + Production). Password y Trusted IPs desactivados                                                                                                    |
| Acceso público                   | 4 URL verificadas sin sesión → **302 a `vercel.com/sso-api`**. Sin acceso público                                                                                                          |
| Variables de entorno             | Ninguna en el proyecto. Modo demo, sin secretos, sin base de datos, sin conectores, WhatsApp en simulación                                                                                 |
| Versión CLI                      | 56.2.0 (última 65.15.0), desactualizada                                                                                                                                                    |
| **Hallazgo adicional de riesgo** | La raíz de ForgeOS tiene versionado `.vercel/project.json` enlazado a **`movos-web`**. Un `vercel deploy` desde la raíz sin `VERCEL_PROJECT_ID` explícito desplegaría en MOVOS. No se tocó |

Conclusión: no hubo exposición pública ni cambio en otros proyectos. La anomalía viene de una regla de plataforma, no de un error del comando. Mientras exista este despliegue en Production, los siguientes despliegues sin `--prod` serán Preview. Aun así, se exigirá verificar `target` antes de compartir cualquier URL; ver [TECH_BACKLOG.md](./TECH_BACKLOG.md) `HF-OPS-01`.

## 2026-11-13 — Continuación Gate 2: decisiones de infraestructura (Álvaro)

1. **Vercel:** opción B temporal. Investigar la causa, preparar un Preview real y aislado, y no desplegar hasta confirmar la configuración.
2. **Supabase:** Hey Foxy completamente separado de MediaFOX OS. Presentar alternativas y costos antes de crear proyectos o contratar. No modificar bases existentes.
3. **Metricool:** conector implementado pero deshabilitado. No solicitar ni almacenar credenciales hasta la autorización de la integración real. Prohibidos los endpoints de escritura, eliminación, campañas y administración de cuentas.
4. **QA:** conservar las pruebas. Re-ejecutadas hoy: 54/54 unitarias y 111/111 de aislamiento SQL.
5. Documentación actualizada: este WORKLOG, [TECH_BACKLOG.md](./TECH_BACKLOG.md) y [09_GATE2_STATUS.md](./09_GATE2_STATUS.md).

## 2026-11-13 — Gate 2: preparación técnica tras la opción A

Decisiones de Álvaro:

- Supabase opción A (organización Pro independiente, solo QA), con presupuesto objetivo de USD 25 al mes y confirmación del importe antes de contratar.
- Vercel congelado; CLI y script de Preview preparados.
- Metricool sigue sin credenciales.
- QA solo con datos sintéticos.
- Secretos separados de MediaFOX OS.

Ejecutado, sin contratar, migrar ni desplegar:

- **Vercel CLI:** 56.2.0 → **65.15.0** (instalación global local; no es un cambio en Vercel).
- **`apps/heyfoxy-web/scripts/deploy-preview.sh`:**
  - Proyecto fijado por ID; ignora el enlace de la raíz que apunta a MOVOS.
  - Verifica directorio, paquete, CLI ≥ 65, rama distinta de `main`, árbol limpio y HEAD publicado.
  - Verifica Root Directory, protección `all`, ausencia de Git y Production congelado en `dpl_CBLq2U37…`.
  - Variables: ninguna de Production y ninguna que apunte a los Supabase de MediaFOX OS. Nunca imprime valores.
  - `deploy` exige `HF_PREVIEW_GO` igual al SHA de HEAD y fija `--environment preview`.
  - `verify` comprueba target, SHA, alias, que Production no cambió y que el acceso anónimo devuelve 302 a SSO.
  - No usa `--verify` de la CLI, porque crearía un secreto de bypass de la protección.
- **Pruebas negativas del script:** 4/4 bloqueos, incluido que `verify` detecta el target `production` del despliegue congelado.
- **Procedimiento Supabase QA, presupuesto y plan de migraciones:** [10_SUPABASE_QA_PROCEDURE.md](./10_SUPABASE_QA_PROCEDURE.md). Precio verificado en supabase.com/pricing.
- **Batería remota sin residuos:** `scripts/build-remote-test-sql.py`. Simulada en PG17 con 111/111 superadas y cero residuos.
- **Seed sintético de QA:** `supabase/seed/qa_seed.sql`. Idempotente y validado con RLS en PG17.
- **Migraciones:** 111/111 también sobre PostgreSQL 17.11.
- **`scripts/smoke-http.sh`:** 32/32. Se corrigió una prueba de roles que no discriminaba, porque el owner también ve los números enmascarados.
- **MOVOS y MediaFOX OS:** sin cambios.

## 2026-11-13 16:11 UTC — Preview n.º 1 (GO de Álvaro para `bb8b422`)

- `HF_PREVIEW_GO=bb8b422 scripts/deploy-preview.sh deploy`: preflight completo.
  - Resultado: **`dpl_9vfWbpvhMz5xu8j3Zh4AX1UD2wJZ`**, `https://heyfoxy-o4qbmlrol-mediafox.vercel.app`.
- Verificación del script:
  - target `preview` y SHA `bb8b422`;
  - sin alias de Production, y Production sigue en `dpl_CBLq2U37…`;
  - acceso anónimo → 302 a SSO en `/`, `/api/health` y `/login`.
- **Hallazgo funcional en la prueba autenticada** (Chrome con la sesión de Vercel del usuario; sin crear enlaces compartidos ni secretos de bypass):
  - **Síntoma:** todas las rutas devuelven 500. Log de runtime: `Cannot find module 'next/dist/compiled/source-map'`.
  - **Causa:** `outputFileTracingRoot: process.cwd()` (copiado de forgeos-web) limitaba el trazado a `apps/heyfoxy-web`. Con pnpm, Next vive en el `node_modules` raíz, así que solo se trazaron 25 archivos en lugar de unos 650.
  - **El despliegue congelado de Production (`fd896ad`) tiene la misma configuración.** Probablemente también responde 500, protegido; no se tocó.
  - **Corrección:**
    - `outputFileTracingRoot` pasa a la raíz del monorepo;
    - nueva guarda `scripts/check-trace.mjs` en `build`, que hace fallar la compilación si el trazado está incompleto (probada en negativo con la configuración anterior: exit 1);
    - re-ejecutados typecheck, lint, 54/54 unitarias y smoke 32/32.
- **Riesgo fuera de alcance (solo reportado):** `apps/forgeos-web/next.config.ts` usa el mismo `outputFileTracingRoot: process.cwd()`.
- El Preview `dpl_9vfWbpvh…` se conserva, protegido. El siguiente Preview requiere un GO nuevo ligado al SHA de la corrección.

## 2026-11-14 04:38 UTC — Preview n.º 2 (GO de Álvaro para `f1e5205`)

- **Antes de desplegar:** `deploy-preview.sh check`, invocado como `scripts/…` desde la app, mostró `FAIL no se encontró apps/heyfoxy-web` y aun así terminó en «CHECK OK».
  - **Causa:** el script resolvía su ruta de forma relativa y el fallo ocurría dentro de un subshell (HF-OPS-07).
  - No se llegó a Vercel. Invocado con ruta absoluta, el preflight y el dry-run quedaron limpios.
  - Se desplegó el commit autorizado sin modificarlo. El script se corrigió después, en un commit separado.
- `HF_PREVIEW_GO=f1e5205 deploy-preview.sh deploy` → **`dpl_BZLKHiH23JYLDTVnJ5rwYeuFDgAU`**, `https://heyfoxy-ckhth0z0b-mediafox.vercel.app`.
  - Target `preview` y SHA `f1e5205`.
  - Sin alias de Production; Production sigue en `dpl_CBLq2U37…`.
  - Acceso anónimo → 302 a SSO.
- **Prueba autenticada en Chrome** (sesión de Vercel del usuario, solo lectura, sin bypass ni enlaces compartidos):
  - `/api/health` → 200 con `sha f1e5205`, `dataMode demo`, `whatsappMode simulate` y conectores en `false`. Cabeceras XFO DENY y noindex, sin X-Powered-By.
  - `/login` → 200, con el selector de personas DEMO y el banner de datos ficticios.
  - Sin sesión, las rutas protegidas redirigen.
  - **Error 500 resuelto.**
- **Smoke en el Preview:** 20/20.
  - Las 10 vistas del owner responden 200, con banner DEMO y aviso de cobertura.
  - Aislamiento: el banco con la cookie de la clínica forjada solo ve Banco Horizonte.
  - Roles: viewer y analyst sin destinatarios WhatsApp; el owner los ve enmascarados.
  - Un usuario forjado redirige.
- **Logs:** sin errores de runtime en los últimos 30 min.
- **MOVOS y MediaFOX OS sin cambios:**
  - último despliegue de `movos-web`: `dpl_FFbCoBAK…` (agosto);
  - último de `mediafox-os`: `dpl_4jZVMJj5…` (653a405), ambos anteriores a esta sesión.
- **Supabase:** solo existe la organización `alipise`. La organización «Hey Foxy» y `heyfoxy-qa` siguen pendientes de Álvaro.

## 2026-11-14 — Gate 2: validación final previa a migraciones (sin migrar)

- **Destino verificado** con el MCP `supabase-heyfoxy-qa`, en solo lectura:
  - `get_project_url` → `https://admbpgqtgmaaofcgajzh.supabase.co`;
  - la URL del MCP fija `project_ref` y no expone herramientas de cuenta;
  - 0 migraciones, 0 tablas en `public`, 0 usuarios de Auth;
  - PostgreSQL 17.11;
  - organización «Hey Foxy» (Pro) confirmada por Álvaro en el dashboard.
  - No se usó el conector claude.ai Supabase.
- **28 frente a 26:** el esquema tiene 26 tablas. El 28 era un error de recuento del WORKLOG y del procedimiento 10. Ver [11](./11_SCHEMA_INVENTORY.md) §1.
- **Hallazgo crítico:** `pg_default_acl` de `heyfoxy-qa` no coincide con lo que asumía el stub local.
  - Una tabla creada por `postgres` solo concede TRUNCATE, REFERENCES, TRIGGER y MAINTAIN a `anon`, `authenticated` y `service_role`. Las funciones no conceden EXECUTE a nadie.
  - Reproducido en local: 0001–0003 aplican sin error, pero la batería falla en la prueba 26 de 111 (`permission denied for table brands`). La app y el servidor se habrían quedado sin acceso en QA.
- **Corrección propuesta (sin aplicar):**
  - Nueva migración `20261113000400_hf_explicit_grants.sql`, con un modelo de privilegios explícito: revoca todo y concede solo donde hay política. 0001–0003 quedan intactas.
  - El stub `00_supabase_stub.sql` ahora reproduce los privilegios reales de QA.
  - Nuevo contrato de esquema `tests/sql/20_schema_contract.check.sql`, de solo lectura, con 31 controles. `test-db.sh` lo exige.
- **Validación local:** `test-db.sh` pasa con el contrato 31/31 y 111/111 en PG17 y PG16, con los privilegios reales y con los antiguos (`HF_STUB_LEGACY_ACL=1`). La batería remota generada termina en `HF_TESTS_PASSED 111` y cero residuos.
- **Procedimiento 10 §3 actualizado:** 4 migraciones, controles previos por migración, criterios de aceptación con valores exactos y advisors esperados.
- **Inventario definitivo:** [11_SCHEMA_INVENTORY.md](./11_SCHEMA_INVENTORY.md).
- **Hallazgos menores** al backlog: HF-SEC-03, HF-SEC-04 y HF-PERF-01.
- Ninguna escritura en `heyfoxy-qa`. MediaFOX OS y MOVOS sin cambios.

## 2026-11-14 06:00–06:10 UTC — Migraciones 0001–0004 aplicadas en `heyfoxy-qa` (GO de Álvaro)

- **Commit autorizado:** `020e3a7` en `feat/heyfoxy-gate2-foundation`, publicado en remoto. Árbol limpio y `test-db.sh` 4/4 sobre ese mismo árbol.
- **Pre-flight:** ref `admbpgqtgmaaofcgajzh`; 0 migraciones, 0 tablas, 0 usuarios y 0 objetos de storage. Preview n.º 2 re-verificado con `deploy-preview.sh verify`; el proyecto Vercel no tiene variables de entorno.
- **Aplicación** con MCP `supabase-heyfoxy-qa` y `apply_migration`, una por una. Antes de cada una se comprobaron el ref y el historial. El contenido guardado en `supabase_migrations` es **byte a byte** idéntico a cada archivo (md5 de los `statements`):

  | Archivo                          | Versión remota   | md5         |
  | -------------------------------- | ---------------- | ----------- |
  | `0001_hf_core_tenancy`           | `20261114060028` | `50e14acc…` |
  | `0002_hf_sources_content`        | `20261114060119` | `aba08c21…` |
  | `0003_hf_intelligence_incidents` | `20261114060215` | `94adf51d…` |
  | `0004_hf_explicit_grants`        | `20261114060647` | `54f2b937…` |

- **Incidente durante 0004:** el MCP perdió la autenticación (`Failed to check user auth status`) y todas las llamadas siguientes fallaron.
  - Se detuvo la secuencia sin reintentar.
  - Álvaro re-autenticó con `/mcp` y autorizó el protocolo de recuperación.
  - El historial mostraba solo 0001–0003.
  - **Huella de privilegios** (765 elementos: grants de tabla y columna, EXECUTE, RLS y políticas): idéntica a la reproducción local tras 0003 (`cd6f7513…`). Esto descartó una ejecución parcial de 0004.
  - Se aplicó 0004 una sola vez. La huella posterior es idéntica a la local tras 0004 (1395 elementos, `28d1c0af…`).
- **QA de seguridad en `heyfoxy-qa`:**
  - Contrato `20_schema_contract.check.sql`: **31/31**. Son 26 tablas con RLS, 37 políticas, 10 enums, 9 funciones `hf_*` (6 DEFINER con `search_path=''`), 18 triggers y 60 índices.
  - Batería remota (transacción abortada a propósito): **`HF_TESTS_PASSED 111`**.
  - Residuos posteriores: 0 usuarios, 0 identidades, 0 filas de negocio y 0 objetos `t_*`.
  - Advisors de seguridad: 0 ERROR. Los 3 hallazgos son los esperados en 10 §3: `hf_is_member`/`hf_has_role` ejecutables por `authenticated` (intencionado), `rls_auto_enable` (previo, de Supabase) e INFO por RLS sin políticas en `platform_staff` e `integration_credentials` (denegación total).
  - Advisors de rendimiento: 0 ERROR. INFO por 27 FK sin índice, 16 índices sin uso (base vacía) y conexiones de Auth; WARN por políticas permisivas múltiples en `brands` y `alert_rules` (HF-PERF-01).
- **Sin cambios** en MediaFOX OS, MOVOS, Production, Metricool ni WhatsApp. No se crearon usuarios ni se cargaron datos.

## 2026-11-14 — Gate 2, etapa 2: Gate A (diagnóstico y correcciones locales; sin cambios remotos)

- **Contexto verificado:**
  - `heyfoxy-qa` con 4 migraciones; 26/37/10/9/18/60; 0 usuarios y 0 filas.
  - Preview n.º 2 protegido y en modo demo.
  - Metricool deshabilitado: el proyecto Vercel no tiene variables de entorno.
- **Ya existía en el código:** login con contraseña, logout, refresco de sesión en el middleware, rutas protegidas, cambio de organización validado contra las membresías reales y repositorio Supabase para las 10 vistas.
- **Inconsistencias encontradas:**
  - El documento 05 lista «Publicaciones» y «Reportes» como MVP, pero no hay vistas (HF-UX-01).
  - Los miembros se mostraban como UUID: `auth.users` no es legible.
  - No había recuperación de contraseña.
- **Hallazgo de seguridad (solo lectura):** el registro público está **activado** en `heyfoxy-qa` (HF-SEC-05). Debe desactivarse antes de Gate B (12 §4).
- **Migración 0005** (aditiva, sin aplicar): corrige HF-SEC-03 (trigger `incidents_refs_guard`) y HF-SEC-04 (UPDATE de `organizations` solo en `name`/`timezone`), y añade `memberships.display_name`.
  - Pruebas: 122/122 y contrato 36/36 en PG17/PG16, con los privilegios reales y con los antiguos.
  - Prueba negativa sin 0005: falla en HF-SEC-04.
  - Rollback probado: huella `28d1c0af…` y 0004 con 31/31 y 111/111.
- **App:**
  - Nombres visibles de miembros y nombre del usuario desde `user_metadata.full_name`.
  - Recuperación de contraseña con PKCE: `/login/recuperar`, `/auth/callback` con lista blanca de destinos y `/login/nueva-clave` con mínimo de 12.
  - Pruebas: typecheck, lint y 54/54 unitarias.
  - Build en modo demo y en modo Supabase.
  - Smoke sin sesión contra QA: rutas privadas → `/login`, callback inválido rechazado, sin redirección abierta y 0 errores.
  - Regresión demo: 32/32.
- **Seed sintético** reescrito (Clínica Aurora / Banco Horizonte) y nuevo `qa_cleanup.sql`.
  - Idempotente, con 0 filas no sintéticas.
  - Historial de incidentes atribuido por los triggers.
  - RLS por usuario verificada; la limpieza deja 0 filas.
- **Credenciales:** `scripts/qa_users.py`.
  - Las contraseñas van solo al llavero de macOS, a través de stdin. El SQL lleva solo hashes y no se puede escribir dentro del repo.
  - `verify` imprime solo OK/FALLO.
  - Probado con un llavero temporal, que después se eliminó.
- **Documentación:** nuevo [12_QA_USERS_AND_ACCESS.md](./12_QA_USERS_AND_ACCESS.md); procedimiento 10 §3/§4.2 e inventario 11 §9 actualizados.
- **Sin cambios** en `heyfoxy-qa`, Vercel, MediaFOX OS ni MOVOS.

## 2026-11-14 06:48–07:05 UTC — Gate B ejecutado en `heyfoxy-qa` (GO de Álvaro)

- **Verificación previa (solo lectura):**
  - ref `admbpgqtgmaaofcgajzh`;
  - `/auth/v1/settings` devuelve `disable_signup: true` y `mailer_autoconfirm: false`;
  - el advisor ya no reporta contraseñas filtradas (protección activa);
  - 4 migraciones, 0 usuarios y 0 datos.
  - Longitud mínima, requisitos de caracteres, cambio seguro y contraseña actual: no son legibles por la API pública ni por el MCP; se toma como evidencia la confirmación de Álvaro.
- **0005** (`20261114000500_hf_sec_fixes_member_names`, versión `20261114064831`): byte a byte idéntica a `867a3aa` (md5 `7e2684d6…`). Contrato **36/36** y batería remota **`HF_TESTS_PASSED 122`**, con 0 residuos.
- **Usuarios:**
  - `qa_users.py create-sql` guardó 6 contraseñas aleatorias de 24 caracteres **solo** en el llavero de inicio de sesión de Álvaro (servicio `Hey Foxy QA (admbpgqtgmaaofcgajzh)`).
  - El SQL de alta solo llevaba hashes bcrypt; se aplicó y se borró del scratchpad.
  - `verify` contra la API de Auth: **6/6 OK (HTTP 200)**.
  - Ninguna contraseña apareció en el chat, Git ni logs.
- **Seed:** dos ejecuciones con conteos idénticos:

  | Elemento                         | Cantidad |
  | -------------------------------- | -------- |
  | Organizaciones                   | 2        |
  | Miembros                         | 6        |
  | Comentarios y análisis           | 20 + 20  |
  | Menciones                        | 5        |
  | Publicaciones                    | 5        |
  | Alertas                          | 7        |
  | Incidentes / eventos             | 3 / 15   |
  | Reportes diarios                 | 5        |
  | Destinatarios WhatsApp ficticios | 3        |

  Verificado: 0 filas no sintéticas, 0 textos sin `[SINTÉTICO]`, 0 usuarios fuera de `@heyfoxy.test`, 0 teléfonos fuera del rango ficticio, Metricool no conectado y 0 envíos no simulados.

- **Permisos efectivos por usuario real** (RLS con la identidad de cada uno, en una transacción revertida):

  | Usuario                    | Organización visible | Comentarios | Alertas | Incidentes | WhatsApp | Auditoría | Uso |
  | -------------------------- | -------------------- | ----------- | ------- | ---------- | -------- | --------- | --- |
  | owner, admin               | Clínica Aurora       | 14          | 5       | 2          | 2        | ✓         | ✓   |
  | analyst, responder, viewer | Clínica Aurora       | 14          | 5       | 2          | —        | —         | —   |
  | owner-b                    | Solo Banco Horizonte | 6           | 2       | 1          | 1        | ✓         | ✓   |

  Las credenciales de integraciones quedan denegadas para los 6.

- **Advisors:** 0 ERROR; solo los WARN e INFO ya documentados.
- **Sin cambios** en Site URL ni Redirect URLs (Gate C), Vercel, Production, Metricool, WhatsApp, MediaFOX OS ni MOVOS.

## 2026-11-14 07:10–08:00 UTC — Gate C: Preview n.º 3, incidente de bypass y vistas nuevas (GO de Álvaro)

- **Pre-flight:**
  - `6009c9c` con el árbol limpio y publicado.
  - `deploy-preview.sh check` en verde: proyecto `heyfoxy-web`, protección `all`, sin Git, Production congelado.
  - MCP apuntando a `admbpgqtgmaaofcgajzh`.
- **Variables**, por API y solo con target `preview`:
  - `NEXT_PUBLIC_SUPABASE_URL` (`plain`) y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`encrypted`).
  - Ninguna en Production, sin `service_role` ni secretos.
- **Preview n.º 3:** `dpl_FYjif3NNiKS22aWFtBoWX9K1R5tL`, SHA `6009c9c`, `https://heyfoxy-iq46k62dl-mediafox.vercel.app`.
  - Verificado: `target=preview`, sin alias de Production, Production en `dpl_CBLq2U37…`, acceso anónimo → SSO.
- **Alias estable:** `heyfoxy-qa-mediafox.vercel.app`. Estaba libre, apunta solo al Preview n.º 3 y está protegido, incluidas `/auth/callback`, `/login/recuperar` y `/login/nueva-clave`.
- **Incidente (HF-OPS-09):** `vercel curl` creó por su cuenta un secreto permanente de «Protection Bypass for Automation». Se detuvo el Gate y se informó.
  - Con la autorización de Álvaro, se identificó sin ambigüedad: el único del proyecto, creado a las 07:13:36 UTC por esta sesión y sin otras automatizaciones.
  - Se revocó sin imprimirlo.
  - Verificado: 0 bypass, protección `all`, Production sin cambios; el Preview, el alias y Production responden 302 → SSO sin sesión.
- **Decisión 3, URLs de Auth:** Site URL y Redirect URL exactas (10 §6). Para que el callback exacto baste por construcción, `redirectTo` pasa a ser `<origen>/auth/callback` sin query, y el callback lleva por defecto a `/login/nueva-clave`.
- **Decisión 4, vistas nuevas** (en local, sin desplegar):
  - `/publicaciones`: listado con filtros por texto, red y orden; métricas; sentimiento dominante; actividad inusual.
  - `/publicaciones/[id]`: KPIs, historial de métricas y comentarios asociados mediante `items({ postId })`.
  - `/reportes`: indicadores con comparación semanal, tendencia de 14 días, temas, cobertura y resúmenes ejecutivos diarios.
  - Lógica compartida en `lib/insights.ts`. Resumen y Conversaciones refactorizados para reutilizarla, sin duplicar código.
- **Regresión:**
  - typecheck, lint y **60/60 unitarias** (6 nuevas de `insights`);
  - build en modo demo y en modo Supabase;
  - smoke demo **40/40** (8 nuevas, incluido el aislamiento por URL directa);
  - sin sesión en modo Supabase: las rutas nuevas → `/login`, callback inválido y redirección abierta rechazados, 0 errores del servidor.
- **QA autenticado:** el clasificador de seguridad bloqueó un E2E local que leía el llavero; coincide con la decisión de Álvaro de no extraer contraseñas. El script se eliminó.
  - Alternativa sin contraseñas: con la identidad de cada usuario QA en el MCP (transacción revertida), las vistas nuevas ven solo su organización (0 filas ajenas).
  - El QA por interfaz queda para el navegador asistido (12 §7).
- **Sin cambios** en Supabase Auth (lo configura Álvaro), Production, Metricool, WhatsApp, MediaFOX OS ni MOVOS.

## 2026-11-14 07:37–07:45 UTC — Gate C: Preview n.º 4 (GO de Álvaro para `1b74b7c`)

- **Pre-flight:**
  - `1b74b7c` con el árbol limpio y publicado;
  - **0 bypass**, protección `all`, Production en `dpl_CBLq2U37…`;
  - `NEXT_PUBLIC_SUPABASE_URL` → `admbpgqtgmaaofcgajzh` (`plain`); la clave publicable es `encrypted`; ambas solo con target `preview`.
- **Despliegue** con `deploy-preview.sh deploy`:
  - **`dpl_2dKCgyHnBb7PEGkg5PwFp7Y23AP5`**, `https://heyfoxy-1lu4rh148-mediafox.vercel.app`, SHA `1b74b7c`;
  - verificado: `target=preview`, sin alias de Production, Production sin cambios, acceso anónimo → SSO.
- **Alias:** `heyfoxy-qa-mediafox.vercel.app` reasignado **solo** al Preview n.º 4 y verificado. Después: 0 bypass, protección `all`, 302 → SSO en `/`, `/publicaciones`, `/reportes`, `/auth/callback` y `/api/health`.
- **Build del despliegue:** compiló `/publicaciones`, `/publicaciones/[id]` y `/reportes`; `check-trace` en verde.
- **Validación de solo lectura** en Chrome con la sesión de Vercel de Álvaro, sin bypass y sin iniciar sesión como usuario QA:
  - `/api/health` → SHA `1b74b7c`, `dataMode: supabase`, `whatsappMode: simulate`, conectores en `false`;
  - `/publicaciones` y `/reportes` sin sesión de la app → `/login`, que muestra el formulario de contraseña;
  - `/login/recuperar` operativo;
  - `/auth/callback` con código falso y `next` externo → `/login?error=enlace-invalido`;
  - `/login/nueva-clave` sin sesión rechaza la solicitud;
  - sin errores de consola y sin 500 en las rutas visitadas.
  - La API de logs de runtime devolvió 0 registros, también a nivel de proyecto, así que no sirve como evidencia en esta ventana.
- **Pendiente:** Álvaro configura Site URL y Redirect URL (10 §6) y valida manualmente (12 §7). Gate 2 sigue abierto.

## 2026-11-20 — V2 UX/UI: WO-HF-V2-DOC y WO-HF-V2-00 (autorizadas por Álvaro)

- **Decisiones de Álvaro** sobre el plan V2 (13 §0):
  - Gate D se cierra antes de la implementación visual general; solo Álvaro lo declara cerrado.
  - Navegación opción A: `/` es Intelligence Home e integra el Resumen.
  - Playwright y axe aprobados como dependencias de desarrollo.
  - Foxy como SVG original.
  - Benchmark y Audiencia: «Próximamente» o «Sin datos disponibles».
  - Claro y oscuro con adopción progresiva.
  - Componentes listos para medios, autores y comentarios reales, sin Metricool.
  - Sin cambios en Supabase, RLS, Auth, MediaFOX OS, MOVOS ni Production.
- **Rama:** `feat/heyfoxy-v2-uxui`, desde `6ac992f`.
- **WO-HF-V2-DOC:**
  - Versionados el doc 13 (con decisiones y correcciones) y `design-system/` (DS **v0.2** y el concepto PNG).
  - DS v0.2: tokens con contraste corregido, superficies por módulo, mascota SVG, estados «Próximamente», componentes de medios y estrategia de temas por ámbito.
  - Nuevo plan detallado: [14](./14_V2_PHASE_PLAN.md).
  - Corrección del diagnóstico: hay 35 colores fijos (no 27); los 8 restantes están en el login y en dos formularios.
- **WO-HF-V2-00:**
  - `@playwright/test` 1.65.0 y `@axe-core/playwright` 4.14.0 (versiones exactas, publicadas hace más de 2 semanas).
  - Primer intento como devDependencies de `heyfoxy-web`: **revertido**. `@playwright/test` es un peer opcional de `next`, y pnpm cambiaba la entrada de `next` de `forgeos-web`, `forge-labs` y `movos-web` en el lockfile raíz, que además pasaban a instalar Playwright.
  - Mismo resultado como paquete separado dentro del workspace. **Solución:** `tools/heyfoxy-qa`, fuera del workspace, con lockfile propio.
  - **`pnpm-lock.yaml` raíz sin cambios.** El `node_modules` local se restauró con `pnpm install --frozen-lockfile`; `movos-web` vuelve a enlazar la instancia original de `next`.
  - Una prueba por vista y viewport (16 × 3 = 48): funcional (HTTP 200, 0 errores de consola o red, `<h1>`), axe WCAG 2.0/2.1/2.2 A/AA contra la deuda conocida, desbordamiento horizontal y captura de página completa.
  - Reloj del servidor fijado solo en QA (`support/fixed-clock.cjs`, por `NODE_OPTIONS`), sin tocar la app.
  - Chrome del sistema; no se descargan navegadores.
- **Línea base registrada** (14 §2):
  - **QA visual:** 48/48 al grabar y 48/48 en la verificación siguiente, sin diferencias. Capturas: 8,4 MB.
  - **axe:** 0 críticas; 2 reglas «serious» como deuda: `link-in-text-block` (18 vistas) y `scrollable-region-focusable` (4).
  - **Sin desbordamiento horizontal.**
  - **Funcional existente:**
    - typecheck y lint en verde;
    - unitarias 60/60;
    - SQL local 122/122 y contrato OK (Postgres efímero; sin Supabase);
    - build en modo demo y en modo Supabase (valores de relleno, sin red), con `check-trace` OK;
    - smoke HTTP 40/40.
- **Hallazgos registrados:**
  - HF-QA-04: deuda de accesibilidad.
  - HF-UX-02: falta el favicon.
  - HF-UX-03: «Asignado a Asignado» en el seed demo.
  - HF-OPS-10: store de pnpm.
  - HF-OPS-11: `.vercelignore`.
  - HF-QA-05: peso de las capturas.
- **Entorno:** el servidor de QA, las pruebas SQL y la instalación con el store pnpm del volumen se ejecutaron fuera del sandbox de Claude Code (puerto local, memoria compartida, store fuera del repo).
- **Sin cambios** en Supabase, migraciones, RLS, Auth, Vercel (sin despliegues), Production, Metricool, WhatsApp, MediaFOX OS ni MOVOS.
- **Gate 2 / Gate D siguen abiertos.** Las WO V2-01 a V2-09 están preparadas (14 §4) y no se implementan sin autorización.

## 2026-11-21 — V2 UX/UI: WO V2-01, V2-02, V2-03, V2-04 y V2-06 (autorizadas por Álvaro; solo local)

- **Decisiones aplicadas:** D-1 (el tema Clásico V1 queda como alternativa; V2 claro por defecto), D-2 (capturas V2 solo de vistas migradas) y D-3 (sin tocar `.vercelignore`).
- **WO-HF-V2-01** (`1fbba5b`):
  - Tokens V2 claro y oscuro junto al legado intacto; preferencia `hf_ui` y tarjeta «Apariencia».
  - Nunito autoalojada (HF-OPS-12) e icono SVG.
  - 35 colores fijos y `text-brand` sustituidos por tokens (mismo valor en legado).
  - Contraste AA verificado por script (68 pares). Deuda `link-in-text-block` cerrada.
- **WO-HF-V2-02** (`f75e30e`):
  - Biblioteca `components/ds`: primitivas, estados («Próximamente», «Sin datos disponibles») y Foxy SVG original.
  - Iconos de redes oficiales (Simple Icons CC0; LinkedIn con Lucide).
  - Gráficos interactivos accesibles con tabla alternativa.
  - Componentes de medios (foto, video y carrusel) con fallback honesto; tipos opcionales `Post.media`/`author`, sin cambios de esquema.
  - Catálogo `/ds` solo en demo. Deuda `scrollable-region-focusable` cerrada: **deuda axe vacía**.
- **WO-HF-V2-03** (`c47a26c`):
  - AppShell: riel en tablet, menú modal en móvil, `switchOrg` sin cambios, tarjeta de usuario con tema.
  - Periodo `?periodo` conservado al navegar y buscador `/buscar`.
  - Corregidos con las pruebas: `parsePeriod('__proto__')` y nombres accesibles (WCAG 2.5.3).
- **WO-HF-V2-04** (`b934458`):
  - Intelligence Home integra el Resumen (opción A).
  - `lib/home-insights.ts` añade funciones puras y probadas, sin tocar `lib/insights.ts`.
  - Hallazgos de Foxy por reglas con base y evidencia.
  - Detectado y corregido un desbordamiento real de 459 px a 390 px. La prueba de QA lo ocultaba: con `isMobile`, `innerWidth` crece; ahora compara contra `clientWidth`.
- **WO-HF-V2-06** (`cc45e92`):
  - Social Explorer: galería, chips por red y filtros del repositorio.
  - Aviso «0 de N con fotos o videos».
  - Detalle con historial, comentarios y Foxy contextual. Aislamiento intacto: una publicación ajena da 404.
- **Regresión en `cc45e92`:**
  - typecheck y lint en verde;
  - unitarias 88/88;
  - SQL local 122/122 y contrato OK;
  - build demo y Supabase en verde;
  - smoke 49/49 (+9 de V2);
  - QA 138/138 en 8 proyectos, con 0 violaciones axe graves y 0 desbordamientos;
  - capturas clásicas sin cambios salvo Configuración.
- **Revisión visual:** [15](./15_V2_REVIEW_HOME_EXPLORER.md), antes y después con capturas reales.
- **Sin cambios** en migraciones, RLS, Auth, Supabase, Vercel (sin despliegues), Production, Metricool, WhatsApp, MediaFOX OS ni MOVOS. Archivos congelados verificados por `git diff --stat` en cada WO.
- **Pendiente:**
  - Gate D (Álvaro);
  - GO por SHA para un Preview V2;
  - validación con `heyfoxy-qa` (HF-QA-06);
  - V2-05, V2-07, V2-08 y V2-09 sin autorizar.

## 2026-11-24 — Preview V2, revisión visual y WO-HF-V2-REFINEMENT-001

- **Preview V2** con GO por SHA (`cdbd36f`) mediante `deploy-preview.sh`:
  - `dpl_CCkrqpDzqUdJTLnVRqogogvzjQ27`, URL `heyfoxy-9xxrzsq21-mediafox.vercel.app`, `target=preview`, **sin alias**;
  - alias V1 `heyfoxy-qa-mediafox` intacto (Preview n.º 4), Production congelado, protección `all`, 0 secretos de bypass;
  - URL de Supabase de Preview verificada contra `heyfoxy-qa` (sin imprimir el valor).
  - Anomalía previa resuelta por Álvaro: la sesión del CLI caducó y luego no tenía el equipo `mediafox` (403); se detuvo el despliegue hasta que Álvaro inició sesión.
- **Revisión visual asistida** (Álvaro inició sesión; 30 capturas con datos de `heyfoxy-qa`, galería en `/Volumes/MediaFOX_DEV/QA/HeyFoxy/V2/2026-11-24/`, fuera de Git).
- **WO-HF-V2-REFINEMENT-001** (local): fases A y B, preparación de Metricool. Detalle y pruebas en [17](./17_V2_REFINEMENT_001.md); WO de Metricool en [16](./16_WO_HF_METRICOOL_INTEGRATION.md).
- **Sin cambios** en migraciones, RLS, Auth, Supabase remoto, Vercel, Production, Metricool, WhatsApp, MediaFOX OS ni MOVOS.

## 2026-11-24 — WO-HF-METRICOOL-INTEGRATION-001

- **Preview refinado** con GO por SHA `a6879cd`: `dpl_H5mNpzaWHognPSVV88qLATwi7ouz` (`heyfoxy-gd3gjh4mk-mediafox.vercel.app`), `target=preview`, sin alias; Preview V1 (alias) y Preview V2 anterior intactos; Production congelado; protección `all`; 0 bypass; Supabase de Preview = `heyfoxy-qa`.
- **Datos QA (preparado, sin escrituras remotas)**: `qa_fix_002_date_spread`, `qa_refresh_dates`, exportación de rollback y rollback de `qa_fix_001`; probado sobre el seed de Gate B envejecido (`scripts/test-qa-seed.sh`).
- **Metricool local**: conector de solo lectura ampliado, motor de sincronización, simulación con servidor sintético, adaptador Supabase (inactivo), pantalla V2 _Fuentes y cobertura_, migración 0006 en `migrations-pending/` probada con rollback. Detalle en [18](./18_METRICOOL_INTEGRATION_001.md).
- **Sin cambios** en migraciones aplicadas, RLS remota, Auth/middleware, Supabase remoto, Production, WhatsApp, MediaFOX OS ni MOVOS. Sin cuentas reales ni datos de MedPlus.

## 2026-11-24/25 — GO 1 Metricool

- **Migración 0006 aplicada en `heyfoxy-qa`** (md5 `551f2305…`, idéntica al archivo versionado; contrato 0005 36/36 antes y 0006 43/43 después). Antes de aplicarla se le añadieron: guarda de datos reales en organizaciones demo, una marca por organización, interruptor global en la base y estados `stopped`/`skipped_not_authorized`.
- **Código**: marca autorizada por organización (`HF_METRICOOL_ALLOWED_BRANDS`) en servicio, motor y conector; el interruptor y la pausa detienen una ejecución en curso; verificación de la clave secreta de Supabase; Explorer y detalle con medios y métricas por red; HF-UX-07; organización por defecto estable (membresía más antigua).
- **Organización independiente** «MediaFOX · Marca autorizada (QA)» (`9c000000-…c1`) creada en `heyfoxy-qa` con `hf_org_marca_autorizada.sql` (probado antes sobre el seed de Gate B con 0006): no demo, único owner `qa-owner`, fuente Metricool no conectada y pausada.
- **Pruebas**: unitarias 131/131, SQL locales OK (0006 46/46), smoke 59/59, QA 170/170. Batería 0006 remota pendiente de confirmación en el diálogo del MCP (expiró sin respuesta; sin residuos).
- **Sin cambios** en Production, Vercel (sin despliegues), Metricool (no activado), MedPlus, WhatsApp, MediaFOX OS ni MOVOS. Detalle en [19](./19_GO1_METRICOOL_ACTIVATION.md).

## 2026-11-26 — Piloto MedPlus (preparación, sin importar)

- **Autorización de MedPlus** confirmada por Álvaro y registrada antes de importar: doc [20](./20_MEDPLUS_PILOT_AUTHORIZATION.md) y `audit_logs` (`hf_medplus_autorizacion_registrada`).
- **Organización** renombrada a «MedPlus · Piloto QA» en `heyfoxy-qa` con el mismo UUID (`hf_org_medplus_piloto.sql`, probado antes en local); sin datos, fuente no conectada y pausada; Aurora y Horizonte intactas.
- **Código**: límites del piloto (`lib/sync/pilot.ts`: Instagram y Facebook, 10 publicaciones por red, comentarios solo de esas publicaciones) y enmascarado de datos personales en comentarios (`lib/sync/privacy.ts`); el permiso de comentarios ya no se consulta para redes fuera del piloto.
- **Vercel**: 7 variables del servidor verificadas por nombre (solo Preview, Secret); sin variables de sincronización automática ni de Production.
- **Pruebas**: unitarias 145/145; `test-qa-seed` OK. Batería 0006 remota otra vez pendiente (confirmación del MCP caducada; sin residuos).
- **Sin cambios** en Production, despliegues, Metricool (sin conectar ni importar), WhatsApp, Storage, MediaFOX OS ni MOVOS.

## 2026-11-26 — GO 3 (Preview MedPlus)

- **Batería 0006 remota: 46/46** (`HF_TESTS_PASSED 46`, transacción revertida) y sin residuos.
- **Anomalía detectada antes de desplegar**: Production apuntaba a `dpl_9YVhLzuo63ByVQJM4sqFMDKq6oLb`, un «Redeploy» del mismo `fd896ad` (2026-11-26 05:07 UTC, cuenta de Álvaro). Álvaro confirmó que fue él; `deploy-preview.sh` lo registra como nuevo Production congelado. Production sin variables propias: no recibió credenciales.
- **Información de salud en texto libre**: los comentarios con información clínica se guardan solo como marcador (doc 20 §3).
- **Preview GO 3 desplegado**: `dpl_EX5aeCPbq9w8VPiR8vKRTVqWhjYj` (`heyfoxy-4qrtzyga1-mediafox.vercel.app`), SHA `d7808c7` (el SHA del mensaje de GO tenía dos caracteres transpuestos; único commit con ese prefijo). Sin alias, protección `all`, 0 bypass, alias V1 y Previews anteriores intactos, Production en `dpl_9YVh…`.
- **HF-UX-08 (bloqueo del selector de organización)**: `qa-owner` tenía las dos membresías (owner) y la RLS respondía bien; el defecto era de interfaz (V2 y clásico). Corregido localmente con prueba e2e; pendiente de GO para desplegar. Mientras tanto: elegir la organización y pulsar «Cambiar organización».

## 2026-11-26 — Primera sincronización MedPlus y WO-HF-METRICOOL-FIX-001

- Primera sincronización real (Álvaro, Preview `d7808c7`): 14 publicaciones con medios y métricas; comentarios fallaron por `social_comments.permalink` inexistente. Detalle, causa y correcciones en [20 §8](./20_MEDPLUS_PILOT_AUTHORIZATION.md).
- Corrección local sin migración; comentarios desactivados por política de privacidad del piloto; contadores y errores de persistencia separados; métricas no aplicables ocultas.
- Sin escrituras remotas, sin nueva sincronización, sin despliegue.

## 2026-11-26 — Preview 689689e y segunda sincronización MedPlus (GO 4)

- **Preview** `dpl_EpK2KMo4Zm2LBwjCeLQr31xV2F67` (`heyfoxy-337wm89pg-mediafox.vercel.app`), SHA `689689e` verificado contra origin y en `/api/health`. Sin alias, protección `all`, 0 bypass, alias V1 y Previews anteriores intactos, Production en `dpl_9YVh…`.
- **Validación previa**: selector cambia a MedPlus solo con el desplegable (HF-UX-08 resuelto en Preview); sin aviso demo; verificaciones del servidor en verde; historial corregido; imagen caducada con «Vista previa caducada · Ábrela en la red original»; Facebook sin 0 inventados.
- **Una sincronización manual** (07:02 UTC): correcta, 3 llamadas (10/500 hoy), 0 errores. 14 publicaciones (0 nuevas, 2 actualizadas, 0 duplicados, mismos ids), 16 mediciones (+2), 14 medios por referencia (URLs sin cambios: Metricool devolvió las mismas), 0 copias a Storage, 0 comentarios (no solicitados por política), sin datos reales fuera de MedPlus.
- **Hallazgos**: solo se refrescan las publicaciones de las últimas 48 h (HF-MC-03); UX HF-UX-09 a HF-UX-14. Capturas en `/Volumes/MediaFOX_DEV/QA/HeyFoxy/V2/2026-11-26/` (fuera de Git).
