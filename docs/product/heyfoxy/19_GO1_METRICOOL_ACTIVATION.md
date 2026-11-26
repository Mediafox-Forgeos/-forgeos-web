# 19 — GO 1: activación Metricool (0006 en QA, guardas y Explorer con medios)

| Propiedad | Valor                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Fecha     | 2026-11-24/25                                                                                        |
| Rama      | `feat/heyfoxy-v2-uxui` (sin fusión a `main`). Gate D abierto                                         |
| Remoto    | Solo `heyfoxy-qa` (`admbpgqtgmaaofcgajzh`) por el MCP `supabase-heyfoxy-qa`                          |
| Sin hacer | Metricool sin activar, sin datos reales, sin MedPlus, sin sincronización automática, sin despliegues |

## 1. Migración 0006 aplicada en `heyfoxy-qa`

- Archivo `supabase/migrations/20261124000600_hf_metricool_media_sync.sql`, md5 **`551f2305977b375d9baa83002aee33e1`**, idéntico byte a byte al registrado en `supabase_migrations.schema_migrations` (versión `20261124163056`). Rollback: `supabase/rollback/…down.sql`, md5 `0d184bb83429daf1d3bf7e78c8f2a0aa`.
- Antes de aplicar: contrato 0005 36/36 en remoto; 0 filas reales en organizaciones demo; nombres nuevos libres; `supautils.policy_grants` permite a `postgres` crear la política de `storage.objects`.
- Después: **contrato 0006 43/43 en remoto** (`tests/sql/20`), bucket `hf-media` privado (2 MB, jpeg/png/webp) y política `hf_media_member_read` presentes.
- Añadido respecto al doc 18 (antes de aplicar, con su prueba):
  - **Datos reales nunca en organizaciones demo** (`hf_guard_real_data_org`): una fuente real no puede quedar conectada ni vinculada a una marca en una organización demo, y ningún contenido no sintético (publicaciones, comentarios, menciones, métricas) puede escribirse en ella.
  - **Una marca, una organización**: índice único `(provider, external_account_ref)`.
  - **Interruptor de emergencia global en la base** (`hf_runtime_flags`, solo `service_role`): efecto inmediato sin redesplegar.
  - Estados de sincronización `stopped` y `skipped_not_authorized`.

## 2. Controles en el código

| Requisito del GO 1                         | Implementación                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7. Solo la marca expresamente autorizada   | `HF_METRICOOL_ALLOWED_BRANDS="<orgId>:<blogId>"`. Se aplica en tres capas: el servicio (lista y conexión solo de esa marca; las demás marcas de la cuenta ni se muestran), el motor (otra marca → `skipped_not_authorized`, 0 llamadas) y el conector (ninguna llamada con otro `blogId` sale a la red). La base añade una marca por organización y ningún dato real en organizaciones demo |
| 6. Organización independiente              | `supabase/seed/hf_org_marca_autorizada.sql` (md5 `31f8276c73971bcbe0c9bd393a6e5dde`): «MediaFOX · Marca autorizada (QA)», id `9c000000-0000-4000-a000-0000000000c1`, **no demo**, fuente Metricool no conectada y pausada, único miembro `qa-owner` (owner). Clínica Aurora y Banco Horizonte siguen siendo demo                                                                            |
| 8. Clave secreta compatible                | `@supabase/supabase-js` 2.119 acepta la clave secreta nueva (`sb_secret_…`) en el servidor (documentación oficial de Supabase); la `service_role` antigua deja de funcionar a finales de 2026. El servidor clasifica la clave sin mostrarla, rechaza claves públicas y, en el Preview, la **verifica leyendo `hf_runtime_flags`**, que solo una clave de servicio puede leer                |
| 9. Interruptor de emergencia efectivo      | Se comprueba antes de cada red y de cada página de comentarios: activarlo, o pausar la organización, detiene una ejecución en curso (`stopped`); lo ya importado se conserva y el cursor no avanza. Dos vías: `hf_runtime_flags` (inmediata) y `HF_SYNC_KILL_SWITCH=on` (requiere redesplegar). Si no puede leerse, se considera activo                                                     |
| 3. Imágenes y métricas en Explorer/detalle | `supabase-repository` lee `post_media` y las métricas nuevas solo con `HF_MIGRATION_0006_APPLIED=true`. El detalle muestra «Métricas de Instagram/Facebook» solo con las que entrega la red (impresiones únicas de Facebook con su nombre, guardados, reproducciones, engagement, reacciones por tipo). Videos: miniatura sin reproductor                                                   |
| 5. HF-UX-07                                | `VideoThumbnail`: sin miniatura o caducada, el texto queda en el centro y el indicador «Video» pasa a la esquina                                                                                                                                                                                                                                                                            |
| 4. Design System V2                        | Mismos componentes y tokens; el tema clásico y las capturas de referencia no cambian (QA 170/170)                                                                                                                                                                                                                                                                                           |

La pantalla _Fuentes y cobertura_ añade **Verificaciones del servidor**: clave de servicio, organización y marca autorizadas, interruptor. Una organización demo o sin marca autorizada aparece como «pendiente» y no toca la red.

## 3. Pruebas

| Prueba                                                               | Resultado                                                                                                               |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Unitarias (incluye `sync-guards`: marca, interruptor, clave)         | 131/131                                                                                                                 |
| `test-migration-0006.sh` (contrato 0005 → 0006 → rollback → 0005)    | OK; batería 0006 46/46                                                                                                  |
| `test-db.sh` (contrato 0006 + aislamiento, también con ACL antiguas) | OK                                                                                                                      |
| `test-qa-seed.sh` (scripts del seed + organización nueva sobre 0006) | OK; Aurora rechaza datos reales; una marca, una organización                                                            |
| Build demo, `check-trace`, smoke HTTP                                | OK; 59/59                                                                                                               |
| QA Playwright (8 proyectos, axe, desbordamiento, capturas)           | 170 superadas, 46 omitidas por diseño (doc 18 §6)                                                                       |
| Remoto: contrato 0005 antes / 0006 después                           | 36/36 / 43/43                                                                                                           |
| Remoto: batería 0006 en transacción revertida (46)                   | **Pendiente de tu confirmación en el diálogo del MCP** (expiró sin respuesta; nada se ejecutó, verificado sin residuos) |

## 4. Variables del servidor (Vercel, solo Preview, Sensitive)

| Variable                         | Valor                                                                     |
| -------------------------------- | ------------------------------------------------------------------------- |
| `HF_METRICOOL_TOKEN`             | API Token (Metricool → Account Settings → API)                            |
| `HF_METRICOOL_USER_ID`           | User ID (misma pantalla)                                                  |
| `HF_METRICOOL_ALLOWED_BRANDS`    | `9c000000-0000-4000-a000-0000000000c1:<Blog ID autorizado>` (**nueva**)   |
| `HF_SUPABASE_SERVICE_ROLE_KEY`   | Clave secreta `sb_secret_…` de `heyfoxy-qa` creada con nombre propio      |
| `HF_AUTHOR_HASH_SALT`            | `openssl rand -base64 48` (≥ 32 caracteres)                               |
| `HF_MIGRATION_0006_APPLIED`      | `true` (0006 ya aplicada)                                                 |
| `HF_CONNECTOR_METRICOOL_ENABLED` | `true`                                                                    |
| No crear                         | `HF_SYNC_SCHEDULE_ENABLED`, `CRON_SECRET` (sin sincronización automática) |

Interruptor inmediato: `update public.hf_runtime_flags set enabled = true, reason = '…', updated_at = now() where flag = 'sync_kill_switch';`

## 5. Pendiente

1. Tu confirmación en el diálogo del MCP para la batería remota 0006 (solo lectura en efecto: se revierte) y para crear la organización de la marca autorizada.
2. **GO 3** con el SHA final para un Preview nuevo sin alias.
3. Primera conexión (GO 4): entrar con `qa-owner`, cambiar a «MediaFOX · Marca autorizada (QA)» en el selector de organización, _Fuentes y cobertura_ → conectar la marca → sincronizar ahora (manual, 30 días, Instagram y Facebook) → _Publicaciones_.
4. MedPlus solo con autorización escrita; GO 5 (sincronización automática) sin autorizar.
