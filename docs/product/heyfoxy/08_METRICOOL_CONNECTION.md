# 08 — Metricool como primera fuente: capacidades verificadas y conexión segura

| Propiedad | Valor                                                                                     |
| --------- | ----------------------------------------------------------------------------------------- |
| Contexto  | Actualización de Álvaro (2026-11-13): **Metricool Advanced contratado y activo**          |
| Alcance   | Primera fuente de datos de Hey Foxy. **Sin conexión de cuentas reales ni ingesta** aún    |
| Fuente    | Especificación OpenAPI oficial `https://app.metricool.com/api/swagger.json` (API 2.0.0)   |
| Estado    | Conector implementado (solo lectura, lista blanca) y **deshabilitado** hasta autorización |

## 1. Capacidades reales de la API (verificadas en la especificación oficial)

| Necesidad Hey Foxy                         | Endpoint Metricool                                                       | Notas                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listar marcas (blogId) accesibles          | `GET /admin/simpleProfiles`                                              | Requiere `userId`; devuelve `blogId` de cada marca                                                                                                               |
| Comentarios de publicaciones propias       | `GET /v2/inbox/post-comments?provider=…`                                 | Respuesta `PostCommentsThread`: hilo con `root` (publicación + comentario raíz) y `comments[]` (id, parentId, owner, text, creationDate); paginación `page.next` |
| Verificar permisos por red sin leer datos  | `GET /v2/inbox/post-comments/authorizations?provider=…`                  | Base para registrar cobertura real y estado "sin permisos"                                                                                                       |
| Publicaciones + métricas por red           | `GET /v2/analytics/posts/{facebook,instagram,linkedin,tiktok,twitter,…}` | Parámetros `from`, `to`, `timezone`                                                                                                                              |
| Reels                                      | `GET /v2/analytics/reels/{facebook,instagram}`                           |                                                                                                                                                                  |
| Series de tiempo / agregados               | `GET /v2/analytics/timelines`, `GET /v2/analytics/aggregation`           | `network`, `metric`, `from`, `to`, `timezone`                                                                                                                    |
| Competidores (referencia pública)          | `GET /v2/analytics/competitors/{network}/…`                              | Publicaciones y métricas públicas. **Sin comentarios de terceros**                                                                                               |
| Consumo de la API                          | `GET /v2/settings/users/{userId}/api-usage-stats`                        | Monitoreo de uso por endpoint                                                                                                                                    |
| Reseñas Google Business Profile (opcional) | `GET /v2/analytics/reviews/gbp`                                          | Fuera del MVP                                                                                                                                                    |

**Autenticación**: cabecera `X-Mc-Auth: <token>` + parámetros `userId` y `blogId` en cada llamada. El token se obtiene en _Account Settings → API_; regenerarlo invalida el anterior de inmediato.

**Lo que la API NO ofrece** (confirmado):

- Webhooks de comentarios para integradores (solo existe una suscripción interna de TikTok). → Hey Foxy usa **sondeo programado** (cada 30 min por defecto, configurable).
- Límites de tasa publicados. → El conector aplica su propio ritmo (≥ 1 s entre llamadas) y límite diario por fuente.
- Menciones de la marca hechas por terceros fuera de sus publicaciones. → Se registran como **no disponibles** en la matriz de cobertura.
- Comentarios en publicaciones de competidores.

**Pendiente de confirmar con la cuenta real** (no se asume): qué redes de MedPlus están conectadas a la marca; qué redes devuelve `authorizations` como autorizadas para comentarios (LinkedIn, TikTok y YouTube dependen de permisos); volumen real y profundidad histórica.

## 2. Riesgo crítico detectado: acciones de escritura expuestas vía GET

La API de Metricool expone operaciones con efecto real incluso como `GET`, por ejemplo:

- `/stats/deletecomment/{provider}`: borra comentarios de Facebook.
- `/stats/facebook/boost/{postId}`: **crea una campaña pagada**.
- `/stats/twitter/follow`: sigue cuentas.
- `/admin/delete-profile`: elimina marcas.
- `/stats/postmessage/{provider}`: publica respuestas.

**Mitigación implementada** (`apps/heyfoxy-web/lib/connectors/metricool.ts`):

- Lista blanca cerrada de 8 patrones de rutas de lectura. Cualquier otra ruta se rechaza **antes** de tocar la red, y está cubierta por pruebas.
- El conector solo emite `GET`. La interfaz `SourceConnector` no tiene métodos de escritura.
- Los errores no incluyen el token ni la URL completa.

## 3. Procedimiento de conexión segura (a ejecutar solo con autorización)

| Paso | Acción                                                                                                                                                                  | Responsable           | Evidencia                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------- |
| 1    | Autorización escrita de MedPlus: cuentas incluidas, usuarios con acceso, finalidad, retención de 90 días                                                                | Álvaro / MedPlus      | Documento firmado (referencia en la base) |
| 2    | Confirmar en Metricool la marca (`blogId`) de MedPlus y las redes conectadas                                                                                            | Álvaro                | Captura de la marca y sus redes           |
| 3    | Entrega del token por canal seguro (gestor de secretos o carga directa como variable cifrada en Vercel por Álvaro). **Nunca** por chat, correo, documento o repositorio | Álvaro                | Variable creada; nadie ve el valor        |
| 4    | Carga: el servidor cifra el token con AES-256-GCM (AAD = organización + fuente) en `integration_credentials`; tabla inaccesible para usuarios                           | VULCAN                | Prueba de cifrado y de RLS                |
| 5    | Prueba de permisos sin contenido: `authorizations` por red → `source_coverage`                                                                                          | VULCAN                | Matriz de cobertura real                  |
| 6    | Prueba acotada en QA: ventana de 24 h, límite de 50 ítems, solo lectura, sin IA externa, y revisión manual del resultado                                                | VULCAN + Álvaro       | Informe con conteos (sin PII)             |
| 7    | Activación con `max_items_per_day`, ingesta pausable e idempotencia por ventana                                                                                         | Requiere GO explícito | Registro en `ingestion_jobs`              |
| 8    | Rotación: regenerar el token en Metricool invalida el anterior. Procedimiento de reemplazo sin pérdida y nueva `key_version`                                            | Álvaro + VULCAN       | Runbook                                   |

**Credenciales no solicitadas ni almacenadas** (decisión de Álvaro, 2026-11-13). **Antes del paso 3 se requiere**: (a) GO explícito para conectar la cuenta real, (b) autorización escrita de MedPlus y (c) Supabase QA de Hey Foxy disponible (ver bloqueo en `09_GATE2_STATUS.md`). Prohibido el uso de endpoints de escritura, eliminación, campañas o administración de cuentas.

## 4. Costo

Metricool Advanced ya está contratado: **costo incremental de USD 0** para Hey Foxy, mientras el uso de la API se mantenga dentro del plan. El consumo se monitorea con `api-usage-stats`.
