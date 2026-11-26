# 20 — Piloto MedPlus: autorización, tratamiento de datos y primera sincronización

| Propiedad | Valor                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Fecha     | 2026-11-26                                                                                            |
| Rama      | `feat/heyfoxy-v2-uxui` (sin fusión a `main`). Gate D abierto                                          |
| Remoto    | Solo `heyfoxy-qa` (`admbpgqtgmaaofcgajzh`) por el MCP `supabase-heyfoxy-qa`                           |
| Sin hacer | Sin datos reales importados, sin conexión de la fuente, sin despliegue, sin sincronización automática |

## 1. Alcance de la autorización (registrado ANTES de importar)

El product owner (Álvaro) confirmó el 2026-11-26 que **MedPlus autoriza el piloto de Hey Foxy con sus datos de redes sociales**. MedPlus es la primera marca real. Registro en la base: `audit_logs.action = 'hf_medplus_autorizacion_registrada'` (organización `9c000000-0000-4000-a000-0000000000c1`, append-only), con el mismo contenido que esta sección.

| Aspecto             | Condición                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entorno             | Solo `heyfoxy-qa` y un Preview protegido (Vercel Authentication). Nunca Production, MediaFOX OS ni MOVOS                                                                   |
| Fuente              | Metricool, **solo lectura**: lista blanca de endpoints GET; nada se publica, responde ni borra en las redes                                                                |
| Redes               | Instagram y Facebook. Las demás redes de la marca se ignoran sin llamadas                                                                                                  |
| Datos               | Publicaciones propias, fotografías y miniaturas **por referencia**, comentarios y respuestas públicos de esas publicaciones, métricas, enlaces originales                  |
| Excluido            | Mensajes privados (el conector no tiene ningún endpoint de mensajes), historias clínicas, copia de medios a Storage, videos completos, WhatsApp, sincronización automática |
| Primera importación | Manual. Últimos 30 días. Como máximo **10 publicaciones por red** (las más recientes); comentarios solo de esas publicaciones                                              |
| Datos personales    | Ver §3                                                                                                                                                                     |
| Retención           | 90 días (`organizations.retention_days`; `post_media.retention_until`)                                                                                                     |
| Acceso              | Solo miembros de «MedPlus · Piloto QA» (RLS). Único miembro: `qa-owner` (owner)                                                                                            |
| Revocación          | Interruptor inmediato (`hf_runtime_flags`), pausa de la organización o desconexión; borrado de lo importado a petición de MedPlus                                          |

## 2. Organización

- `hf_org_marca_autorizada.sql` (GO 1) creó la organización; `supabase/seed/hf_org_medplus_piloto.sql` (md5 `b3b4bed5efd9eaf8305d6ec2428dca15`) la renombró a **«MedPlus · Piloto QA»** (`medplus-piloto-qa`) **conservando el UUID** `9c000000-0000-4000-a000-0000000000c1`, compatible con `HF_METRICOOL_ALLOWED_BRANDS`.
- Se negó a ejecutarse si la organización tuviera datos o fuera demo; es idempotente y documenta su rollback.
- Ejecutado en `heyfoxy-qa` y verificado: no demo, 1 miembro, 0 publicaciones, 0 comentarios, fuente «Metricool · MedPlus» no conectada y pausada, registro de autorización único. Clínica Aurora (3 publicaciones, 14 comentarios, 5 miembros) y Banco Horizonte (2, 6, 1) sin cambios.
- Separación: Aurora y Horizonte son demo y la base rechaza cualquier dato real en ellas (`hf_guard_real_data_org`); una marca solo puede vincularse a una organización (índice único); el servidor solo importa el Blog ID autorizado para esta organización (servicio, motor y conector).

## 3. Protección de datos personales en comentarios

Se aplica en el servidor **antes de guardar** (`lib/sync/privacy.ts`); el texto original no llega a la base:

- Correos, teléfonos, números de documento (CC, TI, CE, NIT, DNI, pasaporte, cédula), tarjetas y números de historia clínica se sustituyen por `[correo]`, `[teléfono]`, `[documento]`, `[tarjeta]`, `[historia clínica]`. Preferimos enmascarar de más (p. ej. una cifra larga) a guardar un dato personal.
- No se guarda el nombre visible del autor ni las imágenes adjuntas a comentarios de terceros; el autor queda como seudónimo HMAC por organización (`HF_AUTHOR_HASH_SALT`), suficiente para deduplicar. La interfaz muestra «Autor no disponible».
- **Información de salud en texto libre (GO 3, 2026-11-26)**: no hay tratamiento autorizado para conservarla. Si un comentario menciona un diagnóstico, una enfermedad o condición (incluida salud mental y embarazo), un tratamiento o procedimiento, resultados de exámenes, medicamentos o la historia clínica, **su texto no se guarda**: queda `[Información de salud no conservada · #<ref>]` con los metadatos (red, publicación, fecha, seudónimo) para contar el volumen. Se detecta por vocabulario, sin tildes ni mayúsculas; preferimos retener de más (p. ej. «después de la cirugía quedé muy bien»). El resultado de cada sincronización cuenta los comentarios retenidos.

## 4. Límites del piloto en el código

`lib/sync/pilot.ts` (`PILOT_LIMITS`), aplicado a toda sincronización real (la simulación demo no cambia): `maxPostsPerNetwork: 10`, `networks: ['instagram', 'facebook']`, `protectPersonalData: true`. El permiso de comentarios también se consulta solo para esas redes (corregido al escribir la prueba). Medios: `copy_allowed = false` siempre; nada se copia a Storage. _Fuentes y cobertura_ muestra la verificación «Límites del piloto».

## 5. Variables de Vercel (verificadas sin leer valores)

`vercel env ls`: las 7 variables del servidor existen, **solo Preview, tipo Secret**: `HF_METRICOOL_TOKEN`, `HF_METRICOOL_USER_ID`, `HF_METRICOOL_ALLOWED_BRANDS`, `HF_SUPABASE_SERVICE_ROLE_KEY`, `HF_AUTHOR_HASH_SALT`, `HF_MIGRATION_0006_APPLIED`, `HF_CONNECTOR_METRICOOL_ENABLED`; más `NEXT_PUBLIC_SUPABASE_URL` (apunta a `heyfoxy-qa`) y la clave publicable. No existen `HF_SYNC_SCHEDULE_ENABLED`, `CRON_SECRET` ni `HF_SYNC_KILL_SWITCH`, ni variables en Production. El formato de `HF_METRICOOL_ALLOWED_BRANDS` (`<orgId>:<Blog ID de MedPlus>`) y la clave de servicio se comprueban en el Preview, en _Verificaciones del servidor_, sin mostrarlos.

## 6. Pruebas

| Prueba                                                                            | Resultado                                                                                     |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Unitarias (nuevas `sync-pilot`: tope, redes, comentarios, enmascarado)            | 145/145                                                                                       |
| `test-qa-seed.sh` (+ renombrado MedPlus, idempotencia, Aurora/Horizonte intactas) | OK                                                                                            |
| Remoto: renombrado y registro de autorización                                     | Verificado                                                                                    |
| Remoto: batería 0006 (46, transacción revertida)                                  | **Pendiente**: la confirmación del diálogo del MCP caducó de nuevo a los 10 min. Sin residuos |

## 7. Primera sincronización (GO 4, no ejecutada)

1. GO 3: Preview nuevo sin alias con el SHA final.
2. Entrar con `qa-owner`, cambiar a «MedPlus · Piloto QA», _Fuentes y cobertura_: todas las verificaciones en verde.
3. Conectar la marca (solo aparece el Blog ID de MedPlus) y pulsar _Sincronizar ahora_ una vez.
4. Revisar _Publicaciones_: como máximo 10 por red, fotos y miniaturas, métricas, comentarios enmascarados y enlace al original.
5. Ante cualquier anomalía: `update public.hf_runtime_flags set enabled = true, reason = '…', updated_at = now() where flag = 'sync_kill_switch';`

## 8. Primera sincronización real y WO-HF-METRICOOL-FIX-001 (2026-11-26)

Álvaro ejecutó la primera sincronización manual en el Preview `d7808c7`: marca MedPlus (Blog ID 7974715), 7 llamadas, resultado parcial.

**Estado verificado en `heyfoxy-qa` (solo lectura):** 14 publicaciones (Instagram 10, Facebook 4), sin duplicados, todas con enlace original; 14 medios por referencia (0 copiados a Storage); 14 mediciones; **0 comentarios**; ningún dato real fuera de MedPlus.

**Causa raíz del error** `Could not find the 'permalink' column of 'social_comments'`: el código escribía `permalink` en `social_comments`, columna que el esquema nunca tuvo (0001). No es caché de PostgREST: el esquema de `heyfoxy-qa` es idéntico a las migraciones (hash de columnas `315883c4…` en local y remoto). Las pruebas usaban el almacén en memoria y no lo detectaban. **No hace falta migración.**

**Correcciones (locales):**

- `commentRow` sin `permalink` (el enlace original es el de la publicación).
- Contrato de esquema (`tests/schema/columns-0006.json`, generado con `scripts/schema-columns.sh`) y prueba de persistencia real contra Postgres con 0001–0006 (`scripts/test-sync-persistence.sh`); detectó además que `ingestion_jobs.cursor` es texto.
- Error interno de persistencia ≠ limitación de Metricool: tipo `persistence`, no reintentable, mensaje genérico con tabla y código, **sin filas ni contenido** (PostgREST puede incluir valores en los detalles).
- Contadores: leídos, guardados, duplicados, fuera de alcance, con información de salud, sobre el límite y no guardados por error; solo lo confirmado por la base cuenta como importado. El historial guarda el desglose en `ingestion_jobs.cursor`; antes presentaba las 14 publicaciones como «14 comentarios». «Elementos importados hoy» pasa a «Comentarios importados hoy» (es lo que mide).
- Métricas no aplicables: Facebook entrega 0 vistas y 0 reproducciones para fotos; ahora se muestran como no disponibles (también las ya guardadas, al leer). Instagram conserva sus vistas reales.

**Privacidad (fase D):** el control de información de salud es por vocabulario y no existe un tratamiento autorizado para texto clínico libre. Por eso **la importación de comentarios queda desactivada** (`PILOT_LIMITS.importComments = false`): no se leen comentarios ni sus permisos y la cobertura lo indica («política de privacidad del piloto»). No hay registros de contenido en logs (`console.*` inexistente en `app/` y `lib/`). Reactivarla requiere un control adicional aprobado (p. ej. revisión humana previa o un clasificador autorizado por MedPlus) y un GO explícito.

**Reintento seguro (requiere GO de despliegue y GO de sincronización):** desplegar el SHA con el script seguro; en _Fuentes y cobertura_ de MedPlus comprobar las verificaciones; pulsar _Sincronizar ahora_ una vez. Resultado esperado: las 14 publicaciones se actualizan (no se duplican; nuevas mediciones), comentarios «desactivados por política», 0 comentarios guardados. Interruptor inmediato disponible.
