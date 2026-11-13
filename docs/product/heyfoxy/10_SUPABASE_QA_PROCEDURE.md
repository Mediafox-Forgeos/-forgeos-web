# 10 — Supabase QA de Hey Foxy: procedimiento, presupuesto, migraciones y pruebas

| Propiedad | Valor                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------- |
| Decisión  | Opción A (Álvaro, 2026-11-13): organización independiente «Hey Foxy» en plan Pro, con un solo proyecto QA |
| Estado    | **Preparado. Sin contratar, sin crear y sin migrar.** Requiere confirmación explícita del importe         |
| Alcance   | Solo QA. Production de Hey Foxy se decide en Gate 3                                                       |

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

**Orden:** se aplican en `heyfoxy-qa` y en ningún otro proyecto, con MCP `apply_migration`, que deja historial en `supabase_migrations`.

| Orden | Archivo                                        | Contenido                                                                                                                                                    |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | `20261113000100_hf_core_tenancy.sql`           | Organizations, brands, memberships, platform_staff y audit_logs (append-only); helpers RLS `SECURITY DEFINER` con `search_path=''`                           |
| 2     | `20261113000200_hf_sources_content.sql`        | Fuentes, cobertura, credenciales (inaccesibles para usuarios), contenido con dedupe, guardas de datos sintéticos y de cruce entre empresas, `ingestion_jobs` |
| 3     | `20261113000300_hf_intelligence_incidents.sql` | Análisis, alertas, incidentes (FSM en la base), eventos append-only, WhatsApp, reportes, presupuestos y uso de IA; grants por columna                        |

**Validación previa, ya ejecutada en local:**

- Las 3 migraciones aplican limpias sobre PostgreSQL **17.11** (Supabase QA usa 17.6) y sobre 16.
- El stub reproduce los privilegios por defecto de Supabase: `anon` y `authenticated` reciben ALL en las tablas nuevas, y cada migración los revoca de forma explícita.

**Después de migrar:**

1. `list_migrations` debe mostrar las 3.
2. `list_tables` debe mostrar 28 tablas con RLS activa.
3. `get_advisors` (security y performance): ningún hallazgo de severidad ERROR. Los WARN se documentan.
4. Batería de aislamiento remota (§4.1).
5. Crear los usuarios QA y cargar el seed (§4.2).

**Reversión (solo QA):** se descarta el proyecto `heyfoxy-qa`, o se ejecuta `drop schema public cascade` y se recrea. No existe ningún dato real que proteger. Nada de esto afecta a MediaFOX OS.

## 4. Pruebas en QA

### 4.1 Batería de aislamiento sin residuos

- `python3 -I apps/heyfoxy-web/scripts/build-remote-test-sql.py > <tmp>/remote_isolation.sql`, y luego ejecutar el archivo en `heyfoxy-qa` con `execute_sql`.
- **Resultado esperado:** error con el texto `HF_TESTS_PASSED 111`. La excepción final aborta la transacción a propósito, así que no queda ningún dato de prueba aunque el cliente use autocommit. Un fallo aparece como `ASSERT FAILED: …` o `HF_TESTS_INCOMPLETE n de 111`.
- **Comprobación posterior:** 0 filas en las tablas de negocio y 0 funciones `t_*`.
- **Validado en local (PG17):** 111/111 y cero residuos. Las secuencias de identidad sí pueden avanzar, lo cual no tiene efecto funcional.

### 4.2 Usuarios y seed sintético

1. Álvaro crea en Auth 6 usuarios sin datos reales: `qa-owner`, `qa-admin`, `qa-analyst`, `qa-responder`, `qa-viewer` y `qa-owner-b`, todos `@heyfoxy.test`.
   - Las contraseñas de prueba se guardan en su gestor; ni en el repositorio ni en el chat.
2. Aplicar `apps/heyfoxy-web/supabase/seed/qa_seed.sql`. Es idempotente y falla si falta algún usuario.
   - Crea 2 empresas sintéticas con `is_demo=true`, comentarios marcados `[SINTÉTICO]` y una fuente Metricool registrada como **no conectada y pausada**.
   - Incluye una alerta crítica pendiente de revisión y un destinatario WhatsApp con un número ficticio.
3. **Validado en local:** carga dos veces sin duplicar. El viewer de la clínica solo ve su empresa (2 alertas, 0 destinatarios WhatsApp) y el owner del banco solo la suya (1 alerta).

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
