# Hey Foxy — WORKLOG (WO-MFOX-HEYFOXY-001)

Registro cronológico de ejecución, decisiones y anomalías. Sin secretos ni credenciales.

## 2026-11-12 — Gate 1

- Propuesta de arquitectura y MVP entregada (documentos 01–07).
- Resultado: **GATE 1 APROBADO CON CONDICIONES** (decisiones 1–7, requisitos A–J).

## 2026-11-13 — Gate 2: fundación

- Rama `feat/heyfoxy-gate2-foundation` en ForgeOS. Commits `a0c2e56` (fundación) y `fd896ad` (ajuste de tipos en una prueba). Sin PR ni fusión a `main`.
- `apps/heyfoxy-web` (Next 15, independiente de MediaFOX OS):
  - 3 migraciones de esquema dev/QA con RLS multiempresa en las 28 tablas;
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
