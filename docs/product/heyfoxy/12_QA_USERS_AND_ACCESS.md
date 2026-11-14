# 12 — Usuarios QA, credenciales privadas y acceso al Preview

| Propiedad   | Valor                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fecha       | 2026-11-14                                                                                                                                                  |
| Entorno     | Solo `heyfoxy-qa` (`admbpgqtgmaaofcgajzh`) y Preview protegido de `heyfoxy-web`                                                                             |
| Estado      | **Usuarios creados en QA el 2026-11-14 (Gate B).** Las contraseñas están solo en el llavero de Álvaro. Login verificado contra la API de Auth: 6/6 HTTP 200 |
| Contraseñas | **Nunca** en este documento, Git, logs, capturas ni chat. Viven solo en el llavero (Keychain) del Mac de Álvaro                                             |

## 1. Matriz de usuarios (sin contraseñas)

Todos son ficticios. Los correos usan `.test`, un dominio reservado (RFC 2606) que no puede pertenecer a terceros ni recibir correo.

| #   | Usuario (correo)            | Nombre visible              | Organización                   | Rol       | Escenario principal                                                                                                                |
| --- | --------------------------- | --------------------------- | ------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `qa-owner@heyfoxy.test`     | Laura Ríos (QA owner)       | Clínica Aurora (QA sintética)  | owner     | Vista completa: WhatsApp (enmascarado), uso, configuración y auditoría. Renombra la organización, pero no cambia plan ni modo demo |
| 2   | `qa-admin@heyfoxy.test`     | Diego Mora (QA admin)       | Clínica Aurora                 | admin     | Igual que owner, salvo que **no** puede crear ni promover owners                                                                   |
| 3   | `qa-analyst@heyfoxy.test`   | Andrea Gil (QA analyst)     | Clínica Aurora                 | analyst   | Revisión humana: confirma o descarta la alerta crítica pendiente («posible infección»). Gestiona incidentes                        |
| 4   | `qa-responder@heyfoxy.test` | Camilo Paz (QA responder)   | Clínica Aurora                 | responder | Abre incidentes desde alertas revisadas, asigna, recorre la FSM, agrega notas y cierra con resumen. **No** revisa alertas          |
| 5   | `qa-viewer@heyfoxy.test`    | Mateo Silva (QA viewer)     | Clínica Aurora                 | viewer    | Solo lectura: sin acciones, sin teléfonos de WhatsApp, sin uso ni auditoría                                                        |
| 6   | `qa-owner-b@heyfoxy.test`   | Sofía Lara (QA owner banco) | Banco Horizonte (QA sintético) | owner     | **Aislamiento:** no debe ver nada de Clínica Aurora, ni por la UI, ni por URL directa, ni manipulando la cookie `hf_org`           |

**Estado de autenticación:** **6/6 OK** con `qa_users.py verify` contra la API de Auth de `heyfoxy-qa` (2026-11-14). La fase se cierra solo cuando Álvaro entra personalmente por la UI del Preview (Gates C y D).

### Permisos efectivos (base de datos y UI)

| Acción                                                                                      | owner |     admin      | analyst | responder | viewer |
| ------------------------------------------------------------------------------------------- | :---: | :------------: | :-----: | :-------: | :----: |
| Ver conversaciones, alertas, temas, incidentes, cobertura y reportes de **su** organización |   ✓   |       ✓        |    ✓    |     ✓     |   ✓    |
| Revisar alertas (confirmar o descartar)                                                     |   ✓   |       ✓        |    ✓    |     —     |   —    |
| Abrir, asignar y transicionar incidentes; notas                                             |   ✓   |       ✓        |    ✓    |     ✓     |   —    |
| Ver destinatarios de WhatsApp (enmascarados), uso, presupuestos y auditoría                 |   ✓   |       ✓        |    —    |     —     |   —    |
| Configurar marcas, reglas, destinatarios y miembros                                         |   ✓   | ✓ (sin owners) |    —    |     —     |   —    |
| Renombrar la organización o cambiar su zona horaria                                         |   ✓   |       ✓        |    —    |     —     |   —    |
| Cambiar `plan`, `is_demo`, `slug` o retención                                               |   —   |       —        |    —    |     —     |   —    |
| Leer credenciales de integraciones o `platform_staff`                                       |   —   |       —        |    —    |     —     |   —    |

La última columna de restricciones la impone la base de datos (RLS, grants por columna y triggers), no solo la UI. Está cubierta por la batería de 122 pruebas.

## 2. Datos sintéticos (seed)

`apps/heyfoxy-web/supabase/seed/qa_seed.sql` es idempotente y está probado dos veces sin duplicar.

| Elemento                           | Clínica Aurora                                                       | Banco Horizonte |
| ---------------------------------- | -------------------------------------------------------------------- | --------------- |
| Marcas                             | 1                                                                    | 1               |
| Cuentas sociales simuladas         | 3                                                                    | 3               |
| Publicaciones (con métricas)       | 3                                                                    | 2               |
| Comentarios clasificados           | 14                                                                   | 6               |
| Menciones                          | 3                                                                    | 2               |
| Temas                              | 6                                                                    | 4               |
| Grupos de conversación             | 1                                                                    | 1               |
| Alertas                            | 5: crítica pendiente, crítica confirmada, alta, atención, descartada | 2               |
| Incidentes                         | 2: uno en investigación con nota, otro cerrado con resumen           | 1 abierto       |
| Reportes diarios                   | 3                                                                    | 2               |
| Destinatarios WhatsApp (ficticios) | 2                                                                    | 1               |

Hay además fuentes y cobertura, incluida Metricool «no conectado» (cobertura parcial declarada), presupuestos, uso de IA y un envío **simulado**.

- **Identificación:** organizaciones con `is_demo = true`, filas con `is_synthetic = true` y textos con el prefijo `[SINTÉTICO]`. La UI muestra la banda «DATOS DE DEMOSTRACIÓN».
- **Contenido:** sin datos de MedPlus ni de Banco de Occidente.
- **Historial de incidentes:** atribuido a los usuarios QA por los triggers reales. Por ejemplo: `opened` por el analyst, transiciones y notas por el responder.
- **Limpieza:** `apps/heyfoxy-web/supabase/seed/qa_cleanup.sql` solo borra las 2 organizaciones sintéticas y los usuarios `@heyfoxy.test`. Requiere GO.

## 3. Credenciales: generación, entrega, consulta y restablecimiento

### 3.1 Cómo se crean (Gate B)

En este Mac, `python3 -I apps/heyfoxy-web/scripts/qa_users.py create-sql <ruta-fuera-del-repo>`:

1. Genera 6 contraseñas aleatorias de 24 caracteres con `secrets`, con mayúsculas, minúsculas, dígitos y símbolos, y sin caracteres ambiguos.
2. Las guarda en el **llavero de inicio de sesión de macOS** con el servicio `Hey Foxy QA (admbpgqtgmaaofcgajzh)`. Se pasan a `security` por stdin, nunca por la línea de comandos.
3. Calcula su hash bcrypt en un Postgres local efímero y escribe un SQL que contiene **solo hashes**, con permisos `600` y fuera del repositorio. El script se niega a escribir dentro del repo.
4. VULCAN aplica ese SQL en `heyfoxy-qa` con el GO de Gate B. A Supabase solo viajan los hashes.

**Probado en local con un llavero temporal:** cada hash corresponde a su contraseña, ninguna contraseña aparece en el SQL, un segundo alta se bloquea y la rotación funciona. El SQL carga sobre una réplica de `auth.users` y `auth.identities` con las columnas reales de QA.

### 3.2 Cómo consultarlas y copiarlas (Álvaro)

- **App Acceso a Llaveros** (Keychain Access):
  1. Buscar «Hey Foxy QA».
  2. Doble clic en el usuario y marcar «Mostrar contraseña». macOS pide la contraseña del Mac.
- **Terminal**, copia al portapapeles sin mostrarla:

  ```bash
  security find-generic-password -s "Hey Foxy QA (admbpgqtgmaaofcgajzh)" -a qa-owner@heyfoxy.test -w | pbcopy
  ```

  Cambiar el correo para cada usuario. Este comando lo ejecuta **solo Álvaro**: si lo ejecutara VULCAN, la contraseña quedaría en el registro de la conversación.

- **Estado sin revelar nada:** `python3 -I apps/heyfoxy-web/scripts/qa_users.py status`.

### 3.3 Cómo restablecer una contraseña

1. `python3 -I apps/heyfoxy-web/scripts/qa_users.py rotate <correo> <ruta-fuera-del-repo>` guarda la nueva contraseña en el llavero y genera un SQL de `UPDATE` con solo el hash.
2. VULCAN aplica el SQL con GO.

La recuperación por correo desde la app (`/login/recuperar`) está implementada, pero **no puede entregar correo a `.test`**. Ver §5.

### 3.4 Verificación sin exponer secretos

Con `HF_SUPABASE_URL` y `HF_SUPABASE_PUBLISHABLE_KEY`, ejecutar `python3 -I apps/heyfoxy-web/scripts/qa_users.py verify`. Inicia sesión en la API de Auth de QA con cada usuario y muestra solo `OK` o `FALLO` y el código HTTP; nunca muestra contraseñas ni tokens.

### 3.5 Eliminación al terminar QA

Con GO, `qa_cleanup.sql` elimina los datos sintéticos y los 6 usuarios. Después hay que borrar las 6 entradas «Hey Foxy QA» del llavero desde Acceso a Llaveros.

## 4. Requisitos previos en el dashboard de Supabase (Álvaro)

El MCP no tiene herramientas de configuración de Auth. Estos pasos los hace Álvaro en Authentication → Settings / URL Configuration:

| #   | Ajuste                         | Valor                                      | Motivo                                                                                                                                                                                          |
| --- | ------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Allow new users to sign up** | **Desactivado**                            | **Hoy está ACTIVADO** (`disable_signup: false`, leído del endpoint público `/auth/v1/settings`). Cualquiera con la clave publicable podría crear cuentas. Es bloqueante para Gate B (HF-SEC-05) |
| 2   | Site URL                       | URL del Preview de Gate C                  | Enlaces de Auth                                                                                                                                                                                 |
| 3   | Redirect URLs                  | `https://heyfoxy-*-mediafox.vercel.app/**` | Permite el retorno de `/auth/callback` solo a Previews de Hey Foxy                                                                                                                              |
| 4   | Longitud mínima de contraseña  | 12                                         | Coherente con `/login/nueva-clave`                                                                                                                                                              |
| 5   | Confirm email                  | Activado                                   | Las cuentas QA ya se crean confirmadas                                                                                                                                                          |

VULCAN verifica el punto 1 en solo lectura con `/auth/v1/settings` antes de crear usuarios.

## 5. Recuperación de contraseña: alcance real

El flujo PKCE está implementado y probado en local hasta donde es posible sin correo: solicitud con respuesta genérica, `/auth/callback` con canje de código y lista blanca de destinos, y `/login/nueva-clave` con una longitud mínima de 12. Dos limitaciones:

- `.test` no recibe correo, por diseño.
- El SMTP integrado de Supabase solo envía a miembros del equipo de la organización.

**Para Gate 2** el restablecimiento se hace con `qa_users.py rotate` (§3.3). La prueba de correo de punta a punta requiere un SMTP propio y queda registrada como HF-AUTH-01.

## 6. Cómo ingresar

1. Abrir **https://heyfoxy-qa-mediafox.vercel.app** (alias estable del Preview de QA). Vercel pide iniciar sesión con la cuenta de Vercel de Álvaro, porque el Preview está protegido y no hay bypass.
2. En `/login`, introducir el correo QA y pegar la contraseña copiada del llavero (§3.2).
3. Cerrar sesión desde «Salir» (barra lateral) y repetir con otro perfil. Para comparar perfiles en paralelo, usar una ventana privada.

> El alias apunta al **Preview n.º 4** (`dpl_2dKCgyHn…`, `1b74b7c`, 2026-11-14), que incluye Publicaciones, Reportes y el callback exacto.

## 7. Guion de QA funcional (Gate D, navegador asistido)

Álvaro inicia sesión. VULCAN recorre las vistas en Chrome con la sesión de Vercel de Álvaro: **no** lee contraseñas, **no** usa `vercel curl` ni bypass.

| #   | Perfil    | Pasos                                                                                                                                           | Resultado esperado                                                                                                  |
| --- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Todos     | Login, navegar, «Salir» y volver a `/`                                                                                                          | Entra a su organización; tras salir, `/` redirige a `/login`                                                        |
| 2   | Todos     | Las 12 vistas: Resumen, Alertas, Revisión, Incidentes, Temas, Publicaciones, Reportes, Conversaciones, Cobertura, WhatsApp, Uso y Configuración | 200 sin errores; banda de datos sintéticos; aviso de cobertura parcial                                              |
| 3   | Todos     | Publicaciones: filtrar por red y por «Más interacciones», abrir el detalle                                                                      | Métricas, historial y comentarios asociados; «Actividad inusual» en la publicación de la app                        |
| 4   | Todos     | Reportes                                                                                                                                        | Indicadores con comparación semanal, tendencia de 14 días, temas, cobertura y 3 resúmenes diarios (2 para el banco) |
| 5   | analyst   | Revisar la alerta crítica «Posible noticia sobre infección»                                                                                     | Confirmada con usuario y fecha                                                                                      |
| 6   | responder | Abrir un incidente desde la alerta confirmada, asignarse, `acknowledged → investigating`, añadir una nota                                       | Historial con actor y eventos                                                                                       |
| 7   | responder | Intentar cerrar sin resumen; después cerrar con resumen                                                                                         | El primer intento se rechaza; el segundo cierra con `closed_at`                                                     |
| 8   | viewer    | Intentar revisar una alerta o abrir un incidente                                                                                                | Sin botones de acción; WhatsApp sin teléfonos                                                                       |
| 9   | admin     | Configuración                                                                                                                                   | No puede crear owners                                                                                               |
| 10  | owner-b   | URL directa a un incidente o una publicación de la clínica; cookie `hf_org` forjada                                                             | 404 y solo Banco Horizonte                                                                                          |
| 11  | Todos     | Consola del navegador y logs de runtime del Preview                                                                                             | Sin errores                                                                                                         |

Verificado ya **sin** navegador:

- Los datos que consumen las vistas nuevas, con la identidad de cada usuario QA (RLS, transacción revertida): la clínica ve 3 publicaciones, 4 mediciones, 14 comentarios enlazados y 3 reportes; el banco, 2, 2, 6 y 2; **0 filas** de la otra organización.
- En modo demo, el smoke HTTP pasa 40/40, incluido el aislamiento por URL directa.
