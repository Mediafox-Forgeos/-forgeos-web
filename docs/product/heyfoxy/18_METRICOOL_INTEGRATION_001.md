# 18 — WO-HF-METRICOOL-INTEGRATION-001: resultado

| Propiedad | Valor                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| Fecha     | 2026-11-24                                                                                                     |
| Rama      | `feat/heyfoxy-v2-uxui` (sin fusión a `main`). Gate D abierto                                                   |
| Preview   | Fase A: refinamiento `a6879cd` → `dpl_H5mNpzaWHognPSVV88qLATwi7ouz` (`heyfoxy-gd3gjh4mk-mediafox.vercel.app`)  |
| Alcance   | Conector, motor de sincronización, pantalla de fuentes, migración 0006 y correcciones del seed: **solo local** |
| Evidencia | Capturas fuera de Git: `/Volumes/MediaFOX_DEV/QA/HeyFoxy/V2/2026-11-24-metricool/capturas/`                    |

## 1. Qué quedó implementado (local)

| #     | Requisito                                 | Dónde                                                                                                             |
| ----- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1–2   | Configuración segura y validación         | `lib/connectors/metricool.ts` (`canAuthenticate`, `listBrands`), errores tipados sin token                        |
| 3     | Marcas y perfiles autorizados             | `/admin/simpleProfiles` → marca, redes conectadas y caducidad de tokens de red                                    |
| 4–5   | Publicaciones y métricas                  | Instagram (posts + reels) y Facebook; métricas con su nombre real (alcance ≠ impresiones únicas)                  |
| 6     | Comentarios y respuestas                  | `/v2/inbox/post-comments` con `parentId`; solo redes con permiso (`authorizations`)                               |
| 7–8   | Red y enlace original                     | `platform` + `permalink` por publicación                                                                          |
| 9     | Deduplicación                             | Id externo + autor seudonimizado + hash de contenido (`planIngestion`)                                            |
| 10    | Incremental                               | Cursor por red: publicaciones desde el fin anterior −48 h (refresca métricas); comentarios desde el último −1 h   |
| 11    | Errores y reintentos                      | Reintentos exponenciales con `Retry-After` ante 429/5xx/red; nunca ante credenciales; resultado «parcial» por red |
| 12    | Consumo de API                            | Presupuesto diario de llamadas (500) y de elementos (5 000) por organización                                      |
| 13–14 | Última sincronización y cobertura real    | Estado por fuente y matriz red × tipo de dato con motivo                                                          |
| 15–16 | Activación, pausa y sincronización manual | `/cobertura` (owner/admin): conectar marca, sincronizar, pausar/reanudar, desconectar (con confirmación)          |
| 17    | Sincronización programada                 | `GET /api/sync/cron` preparada y **desactivada** (flag + `CRON_SECRET`; falta excepción en middleware, GO 5)      |
| 18    | Interruptor de emergencia                 | `HF_SYNC_KILL_SWITCH=on`: ninguna organización sincroniza; la interfaz lo muestra                                 |

Persistencia: almacén en memoria (pruebas y **simulación** del modo demo con un servidor Metricool sintético, sin red) y adaptador Supabase (`lib/sync/supabase-store.ts`, `server-only`, service role) que **solo se activa** con la migración 0006 aplicada y las variables del servidor. Sus mapeos están probados; el adaptador no se ha ejecutado contra una base real (se valida en el GO 4).

## 2. Matriz de cobertura por red (lo que entrega Metricool)

| Red       | Publicaciones                                        | Métricas                                               | Comentarios y respuestas         | Medios                                                                | Menciones de terceros |
| --------- | ---------------------------------------------------- | ------------------------------------------------------ | -------------------------------- | --------------------------------------------------------------------- | --------------------- |
| Instagram | Sí (posts + reels)                                   | Alcance, impresiones, guardados…                       | Sí, si hay permiso               | Imagen/miniatura; carrusel solo vía hilo (parcial); video sin archivo | No                    |
| Facebook  | Sí                                                   | Impresiones únicas (no «alcance»), reacciones por tipo | Sí, si hay permiso               | Imagen; video sin archivo                                             | No                    |
| LinkedIn  | No disponible (endpoint sin parámetros documentados) | —                                                      | Por confirmar (`authorizations`) | —                                                                     | No                    |
| TikTok    | No disponible (solo CSV)                             | —                                                      | Por confirmar                    | —                                                                     | No                    |
| X         | No disponible (CSV; JSON obsoleto)                   | —                                                      | Por confirmar                    | —                                                                     | No                    |
| YouTube   | No disponible (v2 no documentado)                    | —                                                      | Por confirmar                    | —                                                                     | No                    |

La pantalla calcula esta matriz con los permisos reales de la marca en cada sincronización.

## 3. Medios (fase D, arquitectura híbrida)

- **Referencia externa por defecto** (`post_media.source_url`, `copy_allowed = false`).
- **Miniaturas en Storage** (bucket privado `hf-media`, carpeta por organización) solo si `copy_allowed`; la base impide copiar videos completos o fuera de la carpeta de la organización.
- **URLs caducadas**: `url_status`; en la interfaz, «Vista previa caducada» con enlace al original (`SafeImage`).
- **Retención y borrado**: `retention_until` (90 días) + `hf_purge_expired_media()` (solo service role); borrar la publicación borra sus medios.
- Nunca se inventan fotos ni avatares: la simulación usa URLs del dominio reservado `.invalid`.

## 4. Migración 0006 (preparada, no aplicada)

`supabase/migrations-pending/20261124000600_hf_metricool_media_sync.sql` y su rollback en `supabase/rollback/`. Prueba: `scripts/test-migration-0006.sh` (aplicación ×2, 29 aserciones de RLS/guardas/privilegios, rollback a contrato 0005 y reaplicación).

| Archivo                                           | md5                                |
| ------------------------------------------------- | ---------------------------------- |
| `20261124000600_hf_metricool_media_sync.sql`      | `636da85fdb126541892952ea5ca9a8b1` |
| `20261124000600_hf_metricool_media_sync.down.sql` | `ccb30128d16090dcd0b5d9e7d6008888` |

## 5. Datos sintéticos QA (fase B, preparado, sin escrituras remotas)

| Archivo                           | Qué hace                                                                  | md5                                |
| --------------------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| `qa_dates_rollback_export.sql`    | Solo lectura: genera el script que restaura cada fecha (ejecutar primero) | `03cbdd5a94851c77f8d0b58640afb71e` |
| `qa_fix_001_comment_platform.sql` | 6 comentarios a la red de su publicación (idempotente)                    | `dc3bdb9f0b369c7923d7a249f906ee7b` |
| `qa_fix_001_rollback.sql`         | Deshace qa_fix_001                                                        | `e26f3253e74ca58d9779b8f460501d3d` |
| `qa_fix_002_date_spread.sql`      | Reparte fechas en 27 días (una vez; marca en `audit_logs`)                | `54bca679b3b82491ef6c605271866af9` |
| `qa_refresh_dates.sql`            | Desplaza en bloque para que lo último tenga ~1 h (repetible, idempotente) | `fd99c3acd4b302a659fba10b022ba91f` |

**Impacto** (2 organizaciones QA, solo filas del seed): 20 comentarios, 5 menciones, 5 publicaciones, sus mediciones y análisis, 7 alertas, 2 clusters y la cobertura demo. Con 7/14/30 días: 5/9/14 comentarios de Clínica Aurora y periodo anterior con datos en 7 y 14 días.
**Controles**: guardas `is_demo`, `is_synthetic` y `external_id 'qa-…'`; sin tocar usuarios, membresías, incidentes, `incident_events` ni `audit_logs` (salvo las marcas de ejecución); verificación de coherencia al final de cada script. Probado con `scripts/test-qa-seed.sh` sobre el seed de Gate B (867a3aa) envejecido 10 días.
**Rollback**: salida de la exportación + `qa_fix_001_rollback.sql` (probado: estado exacto anterior). Tras un rollback, `qa_fix_002` no vuelve a ejecutarse sin un nuevo GO (marca en `audit_logs`, append-only).

## 6. Pruebas omitidas en la QA (46; antes 30)

Todas son **no aplicables por diseño**, ninguna oculta un fallo:

| Pruebas                                                                                       | Por qué se omiten                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `buscar` y `catalogo-ds` en los 3 proyectos clásicos (6)                                      | Vistas que solo existen en V2                    |
| Interacciones V2 en los 3 proyectos clásicos (12)                                             | Prueban la interfaz V2                           |
| Menú móvil fuera de < 768 px; riel fuera de 768–1279 px; KPI/gráficos fuera de ≥ 1280 px (12) | Cada prueba aplica a un rango de ancho           |
| Flujo de fuentes fuera de `v2-light-1440` (16)                                                | Flujo con estado: se ejecuta en un solo proyecto |

**Antes del piloto real deben ejecutarse (no cubiertas por esta QA local):** E2E autenticado contra `heyfoxy-qa` con los 6 perfiles (HF-QA-03/06); el adaptador Supabase con la migración 0006 aplicada; la muestra acotada de Metricool real (GO 4); la ruta programada con su secreto; y la copia de miniaturas a Storage.

## 7. Procedimiento para conectar tu cuenta Advanced

1. **GO 1 — 0006 en `heyfoxy-qa`**: aplicar el archivo con el md5 de §4 por el MCP `supabase-heyfoxy-qa`; contrato de 0006 y batería SQL antes y después.
2. **Variables del servidor (Preview, cifradas, las cargas tú en Vercel)**: `HF_SUPABASE_SERVICE_ROLE_KEY` (de `heyfoxy-qa`), `HF_AUTHOR_HASH_SALT` (32+ bytes aleatorios), `HF_MIGRATION_0006_APPLIED=true`.
3. **GO 2 — token**: en Metricool, _Account Settings → API_, copias el token y tu `userId`; los cargas tú como `HF_METRICOOL_TOKEN` y `HF_METRICOOL_USER_ID` (cifradas, solo Preview). Nunca por chat. Regenerarlo en Metricool invalida el anterior.
4. **GO 3 — habilitar**: `HF_CONNECTOR_METRICOOL_ENABLED=true` y nuevo Preview con GO por SHA. En _Fuentes y cobertura_ eliges la marca (la lista viene de Metricool; solo valida permisos, no lee contenido).
5. **GO 4 — muestra acotada**: sincronización manual de una organización QA, solo Instagram y Facebook; informe de conteos y campos presentes/ausentes (sin PII), caducidad de URLs y matriz real.
6. **GO 5 — operación**: excepción de middleware para `/api/sync/cron`, `CRON_SECRET`, `HF_SYNC_SCHEDULE_ENABLED=true` y cron cada 30 min. El interruptor de emergencia es `HF_SYNC_KILL_SWITCH=on`.

## 8. Autorizaciones pendientes

1. Revisión del Preview refinado (`heyfoxy-gd3gjh4mk-mediafox.vercel.app`) y Gate D.
2. GO para `qa_dates_rollback_export` + `qa_fix_001` + `qa_fix_002` (+ primera ejecución de `qa_refresh_dates`) en `heyfoxy-qa`.
3. GO 1 (migración 0006 en `heyfoxy-qa`).
4. Carga de variables del servidor (§7.2 y §7.3), hecha por ti.
5. GO 3 (habilitar el conector en un nuevo Preview con SHA).
6. Autorización escrita de MedPlus antes de usar cualquier dato suyo; hasta entonces, solo una marca de prueba de MediaFOX.
7. GO 4 y GO 5.
8. Decisión sobre copia de miniaturas (`copy_allowed`) por marca, sujeta a licencia.
