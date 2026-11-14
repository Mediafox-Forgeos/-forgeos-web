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
