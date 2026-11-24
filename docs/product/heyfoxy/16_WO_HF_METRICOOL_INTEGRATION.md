# 16 — WO-HF-METRICOOL-01: integración real de Metricool Advanced (preparada)

| Propiedad | Valor                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Fecha     | 2026-11-24                                                                                                                    |
| Estado    | **Preparada, no autorizada.** Sin cuentas reales, sin tokens, sin migraciones ejecutadas                                      |
| Fuente    | OpenAPI oficial `https://app.metricool.com/api/swagger.json` (API 2.0.0, 601 rutas), descargada el 2026-11-24                 |
| Base      | [08_METRICOOL_CONNECTION.md](./08_METRICOOL_CONNECTION.md) (conector de solo lectura con lista blanca, deshabilitado)         |
| Regla     | Todo lo marcado «por confirmar» se valida con la cuenta real en el paso 6 del procedimiento; no se asume en la implementación |

## 1. Qué campos entrega la API, por red

Columnas: **sí** = campo tipado en la especificación; **—** = no existe; **?** = la especificación no lo tipa (CSV o sin esquema) y se confirma con la cuenta real.

| Dato Hey Foxy                  | Instagram (posts/reels/stories v2)                        | Facebook (posts v2)                                     | LinkedIn (`/stats/linkedin/posts`)                             | X (`/stats/twitter/posts`, **obsoleto**)    | TikTok (posts v2) | YouTube (`/stats/youtube/videos`, **obsoleto**)       |
| ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------- | ----------------- | ----------------------------------------------------- |
| Identificador                  | `postId` / `reelId`                                       | `postId`                                                | `postId`                                                       | `idStr`                                     | ? (CSV)           | `videoId`                                             |
| Texto original                 | `content`                                                 | `text`                                                  | `description` / `title`                                        | `text`                                      | ?                 | `title`, `description`                                |
| Fecha de publicación           | `publishedAt.dateTime` + zona                             | `created.dateTime` + zona                               | `created.dateTime`                                             | `createdAt`                                 | ?                 | `publishedAt` (epoch)                                 |
| URL de la publicación          | `url` (stories: `permalink`)                              | `link`                                                  | `url`                                                          | — (se construye con `screenName` + `idStr`) | ?                 | `watchUrl`                                            |
| Foto / miniatura               | `imageUrl` (stories: `thumbnailUrl`)                      | `picture`                                               | `picture`                                                      | `imageUrl`, `picture`                       | ?                 | `thumbnailUrl`                                        |
| Video                          | reels: `durationSeconds`, vistas; **sin URL del archivo** | `videoViews` (sin URL del archivo)                      | `videoViews`                                                   | `hasVideo` (booleano)                       | ?                 | `duration`, `aspectRatio`, `videoType`                |
| Carrusel (lista de medios)     | **—** solo `type` (valores no documentados) y una imagen  | **—**                                                   | **—**                                                          | **—**                                       | ?                 | n/a                                                   |
| Tipo de contenido              | `type` (sin enumeración)                                  | `type` (sin enumeración)                                | `type`                                                         | `hasPhoto`/`hasVideo`                       | ?                 | `videoType`                                           |
| Perfil / autor (cuenta propia) | `userId`, `businessId` (sin nombre ni avatar)             | `ownerScreenName`, `ownerDisplayName`, `ownerPicture`   | `companyId`                                                    | `screenName`, `userName`, `ownerPicture`    | ?                 | `ownerScreenName`, `ownerDisplayName`, `ownerPicture` |
| Alcance                        | `reach`, `reachPaid`                                      | `impressionsUnique` (alcance único)                     | `uniqueImpressions`                                            | —                                           | ?                 | —                                                     |
| Impresiones                    | `impressions`, `impressionsTotal`, `impressionsPaid`      | `impressions`, `impressionsOrganic`, `impressionsPaid`  | `impressions`                                                  | `impressions`                               | ?                 | `adImpressions` (solo anuncios)                       |
| Reacciones                     | `likes`                                                   | `reactions` + desglose `like/love/wow/haha/sorry/anger` | `likes` + `praise/empathy/interest/appreciation/entertainment` | `favoriteCount`                             | ?                 | `likes`, `dislikes`                                   |
| Comentarios (conteo)           | `comments`                                                | `comments`                                              | `comments`                                                     | —                                           | ?                 | `comments`                                            |
| Compartidos / guardados        | `shares`, `saved`                                         | `shares`                                                | `shares`                                                       | `retweetCount`                              | ?                 | `shares`                                              |
| Interacciones                  | `interactions`, `engagement`                              | `engagement`, `clicks`                                  | `engagement`, `clicks`                                         | `interactions`, `engagement`                | ?                 | —                                                     |
| Visualizaciones                | `views`, `videoViewsTotal`                                | `videoViews`, `videoTimeWatched`                        | `videoViews`, `viewers`, `timeWatched`                         | —                                           | ?                 | `views`, `watchMinutes`, `averageViewDuration`        |

**Comentarios y respuestas** (`GET /v2/inbox/post-comments?provider=…`, todas las redes que autorice la cuenta):

| Campo                 | Dónde                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Publicación comentada | `root.element`: `id`, `link`, `text`, `mediaUrls[]`, `commentCount`, `reactionCount`              |
| Comentario            | `root.comments[]`: `id`, `parentId` (**respuestas**), `creationDate`, `owner`, `text`, `mediaUrl` |
| Autor                 | `participants[]`: `id`, `name`, `imageProfileUrl` (`email` existe; **no se almacena**)            |
| Estado del hilo       | `status`, `lastUpdateTime`, `lastReadTime`                                                        |
| Permisos por red      | `GET /v2/inbox/post-comments/authorizations` → `missingScopes[]`, `allowAccessToMessages`         |

## 2. Diferencias, permisos y limitaciones

1. **Carruseles: la API de analítica no entrega la lista de medios.** Instagram y Facebook dan una sola imagen (`imageUrl`/`picture`). La única fuente de varios medios es `root.element.mediaUrls[]` del hilo de comentarios, que solo existe para publicaciones **con comentarios**. Consecuencia: un carrusel se mostrará como imagen única salvo que tenga hilo; la interfaz ya lo soporta sin inventar los demás.
2. **No hay URL del archivo de video** en ninguna red; solo miniatura y métricas. Explorer mostrará miniatura + duración + «Ver en la red» (enlace original), no reproducción embebida.
3. **TikTok, LinkedIn (v2) y X (v2) devuelven CSV sin esquema.** Para LinkedIn hay JSON en `/stats/linkedin/posts`; para X el JSON (`/stats/twitter/posts`) está **marcado obsoleto**; TikTok solo tiene CSV. El conector necesita un lector de CSV con validación de columnas o limitarse a Instagram/Facebook/LinkedIn en la primera fase.
4. **YouTube:** `/stats/youtube/videos` está obsoleto y remite a `/v2/analytics/posts/youtube`, que **no figura en la especificación**. Por confirmar con la cuenta real antes de incluir YouTube.
5. **Autor de la cuenta propia en Instagram:** solo `userId`/`businessId`; nombre y avatar salen del perfil de la marca (`/admin/simpleProfiles`), no de cada publicación.
6. **Alcance no homogéneo:** Instagram da `reach`; Facebook y LinkedIn dan impresiones únicas; X y YouTube no tienen alcance. Hey Foxy debe guardar cada métrica con su nombre real y mostrar «—» donde no exista (regla ya aplicada en la interfaz), nunca equipararlas.
7. **URLs de imágenes de CDN de terceros:** por confirmar si caducan (habitual en CDN de Meta). Si caducan, se requiere copia controlada de miniaturas (ver §3, opción B).
8. **Escritura expuesta vía GET** (borrar comentarios, campañas pagadas, seguir cuentas): se mantiene la lista blanca cerrada del conector (08 §2). Las rutas nuevas de esta WO son **todas de lectura**.
9. **Sin webhooks ni límites de tasa publicados:** sondeo programado y ritmo propio (≥ 1 s entre llamadas, tope diario por fuente).
10. **Menciones de terceros y comentarios en publicaciones de competidores: no disponibles.** Siguen como «sin escuchar» en la cobertura.

## 3. Cambios necesarios en el modelo de datos (migración 0006, **no ejecutada**)

Aditiva, sin tocar RLS existente salvo replicar el patrón por organización en la tabla nueva:

| Cambio                                                                                                                                                                                                                     | Motivo                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `social_posts`: `content_type text` (`image`, `video`, `carousel`, `reel`, `story`, `text`), `title text`, `author_display text`, `author_handle text`, `author_avatar_url text`                                           | Tipo de contenido, título (YouTube/LinkedIn) y autor                                   |
| Tabla `post_media` (`organization_id`, `post_id`, `position`, `kind` image/video, `source_url`, `preview_url`, `width`, `height`, `duration_sec`, `alt_text`, `stored_object_path`, `fetched_at`) con RLS por organización | Carruseles, videos y miniaturas; coincide con `Post.media` ya preparado en la interfaz |
| `post_metric_snapshots`: `impressions`, `impressions_unique`, `interactions`, `saves`, `video_views`, `engagement numeric`, `reactions jsonb`                                                                              | Métricas reales por red sin forzarlas a un solo nombre                                 |
| `social_comments`: ya tiene `parent_external_id` (respuestas). Añadir `media_url text`                                                                                                                                     | Comentarios con imagen                                                                 |

**Medios: dos opciones, decisión de Álvaro.** (A) _Solo referencia_: se guarda la URL de la red y la interfaz la muestra con `referrerPolicy="no-referrer"` (ya implementado); costo cero, pero se rompe si la URL caduca. (B) _Copia controlada de miniaturas_ en Supabase Storage privado por organización, con URL firmada de vida corta y borrado según retención (90 días); robusto, requiere bucket, política RLS de Storage y revisión legal de MedPlus. Recomendación: **A en QA para medir caducidad real; B solo si se confirma caducidad.**

## 4. Cambios en el conector (sin activar)

- Lista blanca: añadir `^/v2/analytics/stories/instagram$`, `^/stats/linkedin/posts$` y, solo si se confirma, la ruta v2 de YouTube. Mantener prohibidas todas las demás.
- Normalizador por red → `Post` (`media`, `author`, `contentType`, métricas con nombre real) con pruebas de contrato usando **respuestas de ejemplo sintéticas** construidas desde el esquema (sin datos reales).
- Lector CSV (TikTok/X) solo si se aprueba incluir esas redes en la fase 1.
- Paginación por `page.next`, idempotencia por `(organization_id, data_source_id, external_id)` ya existente.

## 5. Procedimiento seguro de conexión

Se mantiene el de [08 §3](./08_METRICOOL_CONNECTION.md#3-procedimiento-de-conexión-segura-a-ejecutar-solo-con-autorización) con estas condiciones adicionales:

1. **GO 1 — migración 0006** en `heyfoxy-qa`, con el SHA y el md5 del archivo; batería SQL local y contrato antes y después.
2. **GO 2 — token:** Álvaro lo carga directamente como variable cifrada (nunca por chat, correo ni repositorio). VULCAN no lo ve ni lo solicita.
3. **GO 3 — prueba de permisos sin contenido:** solo `authorizations` por red → matriz de cobertura real.
4. **GO 4 — muestra acotada en QA:** 24 h, ≤ 50 publicaciones y ≤ 200 comentarios, solo Instagram y Facebook, sin IA externa; informe con conteos y campos presentes/ausentes por red (sin PII). Aquí se resuelven todos los «por confirmar» de §1–§2, incluida la caducidad de URLs.
5. **GO 5 — activación** con tope diario y pausa; Production sigue fuera de alcance hasta Gate 3.

## 6. Criterios de aceptación

- Ninguna ruta fuera de la lista blanca alcanza la red (pruebas existentes + nuevas rutas).
- Explorer muestra foto, video (miniatura + duración + enlace) y carrusel **solo** cuando la fuente los entrega; «—» y «Sin vista previa» en lo demás.
- Ninguna métrica se renombra ni se completa: alcance ≠ impresiones únicas en la interfaz.
- RLS de `post_media` probada en la batería SQL (aislamiento entre organizaciones).
- `email` de participantes nunca se persiste; autores de comentarios siguen minimizados (`author_hash`).
