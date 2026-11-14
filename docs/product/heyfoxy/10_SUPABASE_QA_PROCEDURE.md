# 10 — Supabase QA de Hey Foxy: procedimiento, presupuesto, migraciones y pruebas

| Propiedad | Valor                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisión  | Opción A (Álvaro, 2026-11-13): organización independiente «Hey Foxy» en plan Pro, con un solo proyecto QA                                                                                               |
| Estado    | **Gate B completado el 2026-11-14:** 0001–0005 aplicadas (0005 desde `867a3aa`), 6 usuarios QA verificados contra la API de Auth, seed sintético cargado. Site URL y Redirect URLs pendientes de Gate C |
| Alcance   | Solo QA. Production de Hey Foxy se decide en Gate 3                                                                                                                                                     |

## 1. Presupuesto final

Fuente: supabase.com/pricing, consultado el 2026-11-13.

| Concepto                                               | USD/mes   |
| ------------------------------------------------------ | --------- |
| Plan Pro (organización «Hey Foxy»)                     | 25,00     |
| Cómputo `heyfoxy-qa` en Micro (≈ USD 10)               | 10,00     |
| Crédito de cómputo incluido en Pro                     | −10,00    |
| **Subtotal**                                           | **25,00** |
| Impuestos indirectos según la dirección de facturación | Variable  |

- **Impuestos:** Supabase aplica IVA, sales tax o GST donde la ley lo exige, según la dirección de facturación. Si se cobrara un IVA del 19 % (Colombia), el total sería **USD 29,75**. El importe exacto se confirma en la pantalla de pago antes de aceptar.
- **Cuotas incluidas en Pro:** 100.000 MAU, 8 GB de disco por proyecto, 250 GB de egress, 100 GB de almacenamiento de archivos y backups diarios con 7 días de retención. QA queda muy por debajo.
- **Spend cap:** viene activado por defecto en Pro y se mantiene así. Con el spend cap activo, al llegar a una cuota no se generan cargos por exceso.
- **Sin complementos:** dominio propio (USD 10), log drains (USD 60), MFA por teléfono (USD 75) y cómputo superior a Micro quedan excluidos.
- **Impacto en MediaFOX OS:** ninguno. La organización `alipise` sigue en Free con sus proyectos sin cambios.

## 2. Procedimiento de creación

| #   | Paso                                                                                                                                                                                                                                                          | Quién                    | Evidencia                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| 1   | **Confirmación explícita del importe** (§1)                                                                                                                                                                                                                   | Álvaro                   | Mensaje de aprobación                                                  |
| 2   | Crear la organización «Hey Foxy» en el dashboard, elegir plan Pro y registrar el método de pago. El agente no introduce datos de pago                                                                                                                         | Álvaro                   | Organización visible y plan `pro` (verificación por MCP, solo lectura) |
| 3   | Verificar que la organización nueva es distinta de `alipise` (`zjqgtzuldpqvonredsrk`) y que el spend cap está activo                                                                                                                                          | VULCAN + Álvaro          | `get_organization`                                                     |
| 4   | Crear el proyecto `heyfoxy-qa` en la región `sa-east-1` (igual que MediaFOX OS, cercana a Colombia), compute Micro. La contraseña de la base la genera y guarda Álvaro en su gestor; **no se comparte**. Las migraciones se aplican por MCP y no la necesitan | Álvaro (o VULCAN con GO) | `ref` del proyecto en el WORKLOG; la contraseña no se registra         |
| 5   | Endurecer Auth: registro público desactivado (el error SEC-1 de MediaFOX no se repite), confirmación de email activa, Site URL y Redirect URLs limitadas al Preview de Hey Foxy, contraseña mínima de 12 caracteres                                           | VULCAN con GO            | Captura de la configuración                                            |
| 6   | Data API: exponer solo el esquema `public`                                                                                                                                                                                                                    | VULCAN                   | Configuración                                                          |
| 7   | Registrar el `ref` permitido (el de `heyfoxy-qa`) en el WORKLOG. Antes de cada operación, VULCAN comprueba que el `ref` coincide y que no es `srsllmqeljhodttqefih` ni `wzamylhiqvosbrlhzssp`                                                                 | VULCAN                   | Comprobación previa en el informe                                      |

## 3. Plan de migraciones

**Destino único:** `heyfoxy-qa`, ref `admbpgqtgmaaofcgajzh`.

- Las migraciones se aplican solo con el MCP `supabase-heyfoxy-qa`, cuya URL fija `project_ref=admbpgqtgmaaofcgajzh` y no expone herramientas de cuenta.
- Se usa `apply_migration`, que deja historial en `supabase_migrations`.
- **Prohibido** usar el conector claude.ai Supabase para esta tarea.

Inventario completo y por qué existe 0004: [11_SCHEMA_INVENTORY.md](./11_SCHEMA_INVENTORY.md).

| Orden | Archivo                                        | Contenido                                                                                                                                                                                                  |
| ----- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `20261113000100_hf_core_tenancy.sql`           | 5 tablas: organizations, brands, memberships, platform_staff y audit_logs (append-only). Helpers RLS `SECURITY DEFINER` con `search_path=''`. 10 políticas                                                 |
| 2     | `20261113000200_hf_sources_content.sql`        | 9 tablas: fuentes, cobertura, credenciales (inaccesibles para usuarios), contenido con dedupe, guardas de datos sintéticos y de cruce entre empresas, `ingestion_jobs`. 9 políticas                        |
| 3     | `20261113000300_hf_intelligence_incidents.sql` | 12 tablas: análisis, alertas, incidentes (FSM en la base), eventos append-only, WhatsApp, reportes, presupuestos y uso de IA. 18 políticas                                                                 |
| 4     | `20261113000400_hf_explicit_grants.sql`        | Sin objetos nuevos. Modelo de privilegios explícito: revoca todo y concede solo lo que exige cada política (grant ⇔ política). Determinista frente a los privilegios por defecto                           |
| 5     | `20261114000500_hf_sec_fixes_member_names.sql` | **Preparada, sin aplicar (Gate B).** Aditiva: HF-SEC-03 (trigger `incidents_refs_guard`), HF-SEC-04 (UPDATE de `organizations` solo en `name` y `timezone`) y `memberships.display_name`. Rollback probado |

**Por qué hay una cuarta migración.** En `heyfoxy-qa`, una tabla creada por `postgres` solo concede TRUNCATE, REFERENCES, TRIGGER y MAINTAIN a `anon`, `authenticated` y `service_role`. Con solo 0001–0003, la app y el servidor se quedarían sin acceso, y `authenticated` conservaría TRUNCATE en 20 tablas. Detalle en 11 §8.

**Validación previa, ejecutada en local el 2026-11-14:**

- `scripts/test-db.sh` aplica las 4 migraciones y pasa en las cuatro combinaciones:

  | PostgreSQL | Privilegios por defecto           | Contrato | Aislamiento |
  | ---------- | --------------------------------- | -------- | ----------- |
  | 17 y 16    | Reales de QA (stub actual)        | 31/31    | 111/111     |
  | 17 y 16    | Antiguos (`HF_STUB_LEGACY_ACL=1`) | 31/31    | 111/111     |

- Con los privilegios reales y **sin** 0004, la batería falla en la prueba 26 (`permission denied for table brands`). Esta prueba negativa demuestra que el stub anterior ocultaba el problema.
- El event trigger `ensure_rls` del proyecto se simuló con su definición literal. Es compatible.
- La batería remota generada termina en `HF_TESTS_PASSED 111` y no deja residuos (0 filas, 0 funciones `t_*`).

**Controles previos, en solo lectura, antes de cada migración:**

1. `get_project_url` devuelve `https://admbpgqtgmaaofcgajzh.supabase.co`, y el ref no es `srsllmqeljhodttqefih` ni `wzamylhiqvosbrlhzssp`.
2. `list_migrations` devuelve exactamente las anteriores: 0, 1, 2 y 3 antes de la 1.ª, 2.ª, 3.ª y 4.ª.
3. El contenido se envía literal desde el commit autorizado, sin editarlo.
4. Si algo falla, se detiene la secuencia. No se corrige sobre la marcha.

**Criterios de aceptación** (todos obligatorios; valores en 11 §2):

1. `list_migrations` muestra las 4 en orden.
2. `list_tables` muestra **26** tablas en `public`, todas con RLS.
3. Contrato de esquema: `execute_sql` con `apps/heyfoxy-web/tests/sql/20_schema_contract.check.sql` devuelve las **31 filas con `ok = true`**. El contrato cubre:
   - 26 tablas, 37 políticas, 10 enums, 9 funciones `hf_*` (6 DEFINER, todas con `search_path=''`), 18 triggers y 60 índices;
   - `anon` sin grants sobre tablas ni EXECUTE sobre `hf_*`;
   - `authenticated` sin TRUNCATE, REFERENCES, TRIGGER ni MAINTAIN, y sin nada sobre `platform_staff` ni `integration_credentials`;
   - los grants por columna;
   - `service_role` con CRUD, sin TRUNCATE y sin mutar las tablas append-only.
4. `get_advisors` de seguridad sin ningún ERROR. WARN e INFO esperados, que se documentan:
   - `authenticated` puede ejecutar `hf_is_member` y `hf_has_role` como SECURITY DEFINER. Es intencionado: son los helpers de RLS y solo devuelven un booleano sobre el propio `auth.uid()`;
   - `rls_auto_enable` (previo, de Supabase; event trigger que no se puede invocar por RPC);
   - RLS sin políticas en `platform_staff` e `integration_credentials`. Es intencionado: denegación total.
5. `get_advisors` de rendimiento sin ningún ERROR. Esperados: FK sin índice (INFO, HF-PERF-01) y políticas permisivas múltiples en `brands` y `alert_rules` (WARN).
6. Batería de aislamiento remota: `HF_TESTS_PASSED 111` y cero residuos (§4.1).
7. Usuarios QA y seed (§4.2) **solo con un GO aparte**.

**Reversión (solo QA):** se descarta el proyecto `heyfoxy-qa`, o se ejecuta `drop schema public cascade` y se recrea; las dos opciones requieren autorización expresa. No existe ningún dato real que proteger. Nada de esto afecta a MediaFOX OS ni a MOVOS.

## 4. Pruebas en QA

### 4.1 Batería de aislamiento sin residuos

- `python3 -I apps/heyfoxy-web/scripts/build-remote-test-sql.py > <tmp>/remote_isolation.sql`, y luego ejecutar el archivo en `heyfoxy-qa` con `execute_sql`.
- **Resultado esperado:** error con el texto `HF_TESTS_PASSED 122` (111 antes de 0005). La excepción final aborta la transacción a propósito, así que no queda ningún dato de prueba aunque el cliente use autocommit. Un fallo aparece como `ASSERT FAILED: …` o `HF_TESTS_INCOMPLETE n de 122`.
- **Comprobación posterior:** 0 filas en las tablas de negocio y 0 funciones `t_*`.
- **Validado en local (PG17):** 111/111 y cero residuos. Las secuencias de identidad sí pueden avanzar, lo cual no tiene efecto funcional.

### 4.2 Usuarios y seed sintético (Gate B, preparado el 2026-11-14)

Detalle completo, matriz de usuarios y entrega de credenciales: [12_QA_USERS_AND_ACCESS.md](./12_QA_USERS_AND_ACCESS.md).

**Requisitos previos:**

- Registro público **desactivado** en Auth (hoy está activado; HF-SEC-05). Se verifica con `/auth/v1/settings`.
- Migración 0005 aplicada.

**Pasos, cada uno con el GO de Gate B:**

1. Aplicar `20261114000500_hf_sec_fixes_member_names.sql` siguiendo el protocolo de §3: ref, historial y verificación de que el contenido almacenado es byte a byte idéntico.
   - Contrato **36/36**.
   - Batería remota **`HF_TESTS_PASSED 122`**.
2. `qa_users.py create-sql` en el Mac de Álvaro: contraseñas solo en el llavero, SQL solo con hashes. Después VULCAN aplica ese SQL.
3. `qa_users.py verify`: 6 × `OK`.
4. Aplicar `apps/heyfoxy-web/supabase/seed/qa_seed.sql`. Es idempotente y falla si falta algún usuario.

**Validado en local:**

- Alta de usuarios sobre una réplica de `auth`.
- Seed ejecutado dos veces sin duplicados y sin filas no sintéticas.
- Visibilidad por usuario:

  | Usuario              | Comentarios | Alertas | Incidentes | Teléfonos de WhatsApp |
  | -------------------- | ----------- | ------- | ---------- | --------------------- |
  | Viewer de la clínica | 14          | 5       | 2          | 0                     |
  | Owner del banco      | 6           | 2       | 1          | Solo los del banco    |

- La limpieza deja 0 filas y vuelve a activar las guardas append-only (contrato 36/36).

**Rollback de 0005:** `apps/heyfoxy-web/supabase/rollback/20261114000500_hf_sec_fixes_member_names.down.sql`, con GO. Probado en local: la huella de privilegios vuelve a ser idéntica a la de 0004 (`28d1c0af…`) y pasan el contrato 31/31 y la batería 111/111 de 0004.

### 4.3 Matriz funcional en Preview, tras el primer Preview autorizado

| Área           | Prueba                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticación  | Login con contraseña de cada usuario QA; sin sesión se redirige a `/login`; logout; registro público rechazado                            |
| Roles          | Viewer sin acciones; analyst revisa alertas; responder gestiona incidentes; admin/owner ven WhatsApp y uso; admin no puede crear owner    |
| Aislamiento    | `qa-owner-b` no ve nada de la clínica por UI, por URL directa (`/incidentes/<id>`) ni manipulando la cookie `hf_org`                      |
| Alertas        | Una alerta crítica exige revisión humana antes de escalar; revisión con usuario y fecha                                                   |
| Incidentes     | Abrir desde alerta, asignar, recorrer la FSM, nota, cierre con resumen obligatorio, historial append-only                                 |
| Command Center | Las 11 vistas; avisos de cobertura parcial y fuentes no conectadas; separación entre lo operativo y lo reputacional; móvil a 390 y 820 px |
| WhatsApp       | Solo `simulate`; ningún envío real                                                                                                        |

## 5. Variables por entorno (Vercel `heyfoxy-web`)

| Variable                                              | Preview                                                                                      | Production               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                            | URL de `heyfoxy-qa` (tipo `plain`, para que el script verifique que no apunta a MediaFOX OS) | **Ninguna** hasta Gate 3 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                | Clave publicable de `heyfoxy-qa` (pública por diseño; RLS protege los datos)                 | Ninguna                  |
| `HF_WHATSAPP_MODE`                                    | `simulate` (también es el valor por defecto)                                                 | Ninguna                  |
| Service role, `HF_CREDENTIALS_KEK`, Metricool, OpenAI | **No se cargan en Gate 2**                                                                   | Ninguna                  |

Los secretos de Hey Foxy y de MediaFOX OS nunca se comparten: son proyectos de Supabase y de Vercel distintos y no se reutiliza ninguna clave.
