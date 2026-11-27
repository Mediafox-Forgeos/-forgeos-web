# 25 — Guía de activación: Foxy Intelligence Engine con IA generativa

| Propiedad | Valor                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fecha     | 2026-11-27                                                                                                                                                                           |
| Estado    | **GO-IA-0 y GO-IA-1 aprobados (2026-11-27); adaptador implementado en local (doc [26](./26_WO_HF_AI_ENGINE_001.md)).** Ningún proveedor activado, sin claves, sin llamadas con costo |
| Base      | Doc [22](./22_AI_PROVIDER_RECOMMENDATION.md) (recomendación) + documentación oficial de Anthropic consultada el 2026-11-27 (enlaces al final)                                        |
| Decisión  | Integración por **API REST** (`fetch` a `/v1/messages`) sin añadir dependencias: no cambia el lockfile compartido de MediaFOX OS ni MOVOS                                            |

Hoy Foxy funciona con el motor local por reglas. Esta guía dice qué se usará, dónde se configura, cuánto cuesta, qué condiciones de datos aplican y qué GO hacen falta, en orden. **No se ha activado nada.**

## 1. Proveedor y modelos por tarea

**Proveedor: Anthropic (Claude API, `api.anthropic.com`)**, con Anthropic como encargado del tratamiento. Modelos vigentes y de disponibilidad general:

| Tarea de Foxy                                                                                          | Modelo            | ID exacto           | Por qué                                                                    |
| ------------------------------------------------------------------------------------------------------ | ----------------- | ------------------- | -------------------------------------------------------------------------- |
| Etiquetado de cada publicación: temática, formato, hook, CTA, pilar candidato (salida estructurada)    | Claude Haiku 5.5  | `claude-haiku-5-5`  | Volumen alto, latencia baja, US$0,10 / 0,50 por millón (prompts ≤ 100 000) |
| Análisis de contenido (texto + imagen): concepto visual, coherencia con tono, pilar y campaña          | Claude Sonnet 5.5 | `claude-sonnet-5-5` | Visión de alta resolución con buena relación calidad/costo (US$2 / 10)     |
| Ask Foxy (lateral y general) en streaming                                                              | Claude Sonnet 5.5 | `claude-sonnet-5-5` | Respuesta rápida y conversacional; Brand Brain en caché (lectura US$0,10)  |
| Análisis estratégico: informe mensual, cruce de histórico, Brand Brain y campañas, brief creativo      | Claude Opus 5.5   | `claude-opus-5-5`   | Razonamiento más profundo; poco frecuente (US$4 / 20)                      |
| Más adelante: extracción de la Brand Knowledge Library (PDF: objetivos, pilares, campañas, audiencias) | Claude Sonnet 5.5 | `claude-sonnet-5-5` | PDF nativo en la API; propuesta validada por una persona (§9)              |

Notas técnicas que el adaptador debe respetar (verificadas):

- Cabecera `anthropic-version: 2026-10-21`. Con esa versión **no se envían** `temperature`, `top_p` ni `top_k` (error 400) ni texto de relleno del asistente (prefill).
- Los tres modelos piensan de forma adaptativa por defecto: la profundidad se controla con `output_config.effort` (bajo para etiquetado, medio para Ask Foxy). La respuesta puede empezar con bloques `thinking`: el adaptador lee solo los bloques `text`. Los tokens de razonamiento se facturan como salida (se incluye un margen en §4).
- Salida estructurada con `output_config.format` (`json_schema`), validada además con los esquemas zod de `lib/intel/schema` y la guarda de evidencia (`lib/intel/guard`): la evidencia que no estaba en la entrada se descarta.
- Una respuesta puede terminar en `stop_reason: "refusal"` (clasificadores de seguridad): Foxy lo declara y vuelve al motor local; nunca inventa la respuesta.
- No se usan Fable ni Mythos (exigen retención de 30 días) ni Batch API (ver §6).

## 2. Integración por API REST (sin dependencias nuevas)

El repositorio ya integra un proveedor por `fetch` (`lib/ai/providers.ts`, clasificador V1). El adaptador de Anthropic seguirá ese patrón:

| Pieza                   | Diseño                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Llamada                 | `POST https://api.anthropic.com/v1/messages` con `x-api-key`, `anthropic-version: 2026-10-21`, `content-type: application/json`. Solo en servidor (`server-only`); nunca desde el navegador |
| Streaming de Ask Foxy   | `stream: true`; se leen los eventos SSE (`content_block_delta` → `text_delta`) y se reenvían al panel lateral, que ya tiene turnos preparados para streaming (`useFoxyConversation`)        |
| Reintentos              | Solo para 429, 500, 529 y errores de red, con espera exponencial y máximo 2 reintentos; respeta `retry-after`. Nunca reintenta un 400                                                       |
| Tiempo máximo           | 30 s etiquetado/contenido, 60 s estrategia; al vencer, motor local con aviso                                                                                                                |
| Costo                   | `usage` de cada respuesta (incluye lecturas y escrituras de caché) → `ai_usage` con precio por modelo; antes de llamar se comprueba `usage_budgets` (corte duro)                            |
| Caché                   | Prompt caching del sistema + Brand Brain (`cache_control`) y caché propia por hash de entrada (`content_intel_cache`, 0007) para no reanalizar lo que no cambió                             |
| Decisión de proveedor   | `decideProvider` (`lib/intel/guard.ts`): hoy devuelve siempre el motor local; el adaptador solo se habilita cuando existen proveedor, clave, organización autorizada y presupuesto          |
| Seguridad del contenido | El copy de las publicaciones es dato no confiable: `sanitizeUntrusted` + `wrapUntrusted` (delimitado), y validación de la salida                                                            |
| Identificación en la UI | Cada respuesta indica proveedor y modelo («Claude Sonnet 5.5 · IA generativa») o «Motor local por reglas»; nunca se presenta una respuesta de reglas como generativa                        |

Alternativa descartada por ahora: el SDK oficial `@anthropic-ai/sdk` cambia la entrada de `next` de MediaFOX OS y MOVOS en el lockfile compartido (HF-AI-10). Se puede reconsiderar con autorización de sus responsables.

**Adaptador implementado en local (GO-IA-1, doc 26).** Las pruebas usan `fetch` simulado con respuestas grabadas; no generan costo. En el Preview (Supabase) requiere además la migración 0009 aplicada y `HF_MIGRATION_0009_APPLIED`; el procedimiento exacto de GO-IA-2 está en el doc 26 §9: la clave se carga en GO-IA-2 y `HF_AI_CONTENT_PROVIDER=anthropic` se crea recién en GO-IA-3, para que GO-IA-2 no produzca ninguna llamada.

## 3. Cuenta, API Key y variables

### 3.1 Dónde se crea la API Key (lo hace Álvaro; la clave nunca pasa por el chat)

1. Entrar a la **Claude Console**: <https://platform.claude.com> con la cuenta corporativa de MediaFOX (organización comercial, no una cuenta personal de claude.ai).
2. **Billing**: cargar crédito prepago (sugerido US$25) y **desactivar la recarga automática** durante el piloto.
3. **Workspaces**: crear un workspace dedicado, `heyfoxy-preview`. Aislar Hey Foxy de cualquier otro uso de MediaFOX permite limitar gasto, auditar consumo y revocar sin afectar a nadie más.
4. En el workspace, fijar el **límite de gasto mensual** (§4.2).
5. **API Keys** → _Create Key_ en el workspace `heyfoxy-preview`, nombre `heyfoxy-preview-2026-12`. La Console muestra la clave una sola vez.
6. Pegarla **directamente en Vercel** (§3.2). No guardarla en archivos, chats, tickets ni en el repositorio.
7. **No activar** HIPAA readiness en esta organización (§6.3): es permanente y no hace falta para el piloto.

### 3.2 Dónde se configuran las variables

Vercel → proyecto **heyfoxy-web** → _Settings_ → _Environment Variables_, **solo entorno Preview**, tipo **Sensitive**. Nunca Production ni Development. Alternativa por terminal (la ejecuta Álvaro con `!` en esta sesión; la clave se teclea en el prompt oculto del CLI):

```bash
vercel env add ANTHROPIC_API_KEY preview --sensitive --scope mediafox
```

| Variable                 | Valor                                                                   | Cuándo se crea                                       |
| ------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `ANTHROPIC_API_KEY`      | Clave del workspace `heyfoxy-preview` (Sensitive)                       | GO-IA-2, después de desplegar el adaptador sin clave |
| `HF_AI_CONTENT_PROVIDER` | `anthropic`                                                             | GO-IA-2                                              |
| `HF_AI_MODEL_FAST`       | `claude-haiku-5-5`                                                      | GO-IA-2                                              |
| `HF_AI_MODEL_CONTENT`    | `claude-sonnet-5-5`                                                     | GO-IA-2                                              |
| `HF_AI_MODEL_STRATEGY`   | `claude-opus-5-5`                                                       | GO-IA-2                                              |
| `HF_AI_REAL_DATA_ORGS`   | Vacía. Con GO-IA-5: el UUID de «MedPlus · Piloto QA»                    | GO-IA-5                                              |
| `HF_AI_MULTIMODAL_ORGS`  | Vacía. Con GO-IA-6: el UUID de MedPlus (envío de imágenes)              | GO-IA-6 (variable nueva del adaptador)               |
| `HF_AI_KILL_SWITCH`      | No crear salvo emergencia (`on` apaga la IA en el siguiente despliegue) | Solo en emergencia                                   |

Interruptor inmediato sin redesplegar: `update public.hf_runtime_flags set enabled = true where flag = 'ai_kill_switch';`

**No crear** `HF_AI_PROVIDER` ni `OPENAI_API_KEY`: activan el clasificador de comentarios V1 (OpenAI), que no forma parte de este plan. Hoy no existen en Vercel (verificado el 2026-11-27).

## 4. Costos y presupuesto

### 4.1 Costo estimado (precios oficiales, sin descuentos)

| Concepto (piloto MedPlus, 14–40 publicaciones/mes)             | Unidad      | Volumen/mes | Costo/mes  |
| -------------------------------------------------------------- | ----------- | ----------- | ---------- |
| Etiquetado (Haiku 5.5, ≈ 2 000 entrada + 300 salida)           | ≈ US$0,0004 | 40          | US$0,02    |
| Análisis de contenido con imagen (Sonnet 5.5, ≈ 5 000 + 1 500) | ≈ US$0,025  | 40          | US$1,00    |
| Ask Foxy (Sonnet 5.5, contexto en caché + 800 de salida)       | ≈ US$0,014  | 300         | US$4,20    |
| Informe estratégico (Opus 5.5, ≈ 30 000 + 4 000, sin Batch)    | ≈ US$0,20   | 4           | US$0,80    |
| **Subtotal**                                                   |             |             | **≈ US$6** |
| Margen por razonamiento adaptativo y reintentos (+50 %)        |             |             | **≈ US$9** |

Una imagen de Instagram de 1080×1350 cuesta unos 1 911 tokens visuales (`⌈ancho/28⌉ × ⌈alto/28⌉`; Sonnet 5.5 no la reduce hasta 2 576 px de lado largo): ≈ US$0,004 por imagen.

### 4.2 Presupuesto que hay que configurar

| Nivel                         | Dónde                                                    | Valor recomendado                                                    |
| ----------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| Límite de gasto del workspace | Claude Console → workspace `heyfoxy-preview` → límites   | **US$25/mes** (tope duro de todo Hey Foxy Preview)                   |
| Crédito prepago               | Claude Console → Billing                                 | US$25, sin recarga automática                                        |
| Pruebas sintéticas (GO-IA-3)  | `usage_budgets` de Clínica Aurora y Banco Horizonte (QA) | **US$5 en total** (`ai_monthly_usd` 2,50 cada una, `hard_stop` true) |
| MedPlus (GO-IA-5)             | `usage_budgets` de «MedPlus · Piloto QA»                 | **US$15/mes**, `ai_daily_items` 200, `hard_stop` true                |
| Por solicitud                 | Adaptador (`max_tokens`)                                 | 1 000 etiquetado · 2 000 contenido · 1 500 Ask Foxy · 8 000 informe  |

Al llegar al tope, Foxy vuelve al motor local y lo indica en pantalla. El consumo real queda en `ai_usage` (tokens, caché, costo por tarea y modelo).

## 5. Pruebas con datos sintéticos (GO-IA-3)

Antes de cualquier dato real:

1. **Sin costo, en local**: pruebas del adaptador con `fetch` simulado y respuestas grabadas (éxito, 400, 429, 529, `refusal`, salida inválida, evidencia inventada, tiempo agotado, presupuesto agotado, interruptor activo). Deben pasar vitest, tsc, ESLint, Playwright y axe.
2. **Preview desplegado sin clave**: confirmar que todo sigue en «Motor local por reglas» y que no hay llamadas salientes.
3. **Con clave y GO-IA-3**, solo en Clínica Aurora QA y Banco Horizonte QA (organizaciones `is_demo`, publicaciones `is_synthetic`). `decideProvider` rechaza cualquier entrada no sintética mientras `HF_AI_REAL_DATA_ORGS` esté vacía.
4. **Juego de prueba**: 20 ejecuciones medidas (5 etiquetados, 5 análisis de contenido con imagen sintética, 8 preguntas de Ask Foxy, 2 informes). Tope US$5.
5. **Criterios de aceptación**, revisados por Álvaro sobre una tabla de resultados:
   - 100 % de salidas válidas contra el esquema, o descartadas con motivo.
   - 0 evidencias que no estén en la entrada.
   - 0 comparaciones de engagement entre redes y 0 afirmaciones causales.
   - Con muestra insuficiente (< 3 comparables), la recomendación se formula como hipótesis (pendiente HF-AI-15).
   - Hechos, interpretaciones, hipótesis y recomendaciones separados.
   - Costo medido por tarea dentro de ±50 % de §4.1.
   - Interruptor (`ai_kill_switch`) y tope de presupuesto comprobados en vivo.
6. Resultado en el WORKLOG y en un documento de validación, con capturas fuera de Git.

## 6. Tratamiento y retención de datos

### 6.1 Qué dice Anthropic (página oficial «API and data retention», 2026-11-27)

- El contenido de las conversaciones (prompts y respuestas) **no se conserva por defecto** en la Messages API; la excepción son los «Covered Models» (Fable y Mythos), que exigen 30 días y no se usan aquí. Esto resuelve la duda abierta en el doc 22 §5.
- Los datos **no se usan para entrenar** modelos sin permiso expreso.
- Salida estructurada: no se guardan prompts ni respuestas, pero **el esquema JSON se guarda en caché hasta 24 h**. Los esquemas de Foxy no deben contener datos de MedPlus (solo nombres de campos genéricos).
- Prompt caching: solo representaciones en memoria durante el TTL de la caché.
- **Batch API: retención de 29 días**, no elegible para ZDR. Por eso el piloto no usa Batch: el ahorro sería de unos US$0,40 al mes.
- **Excepción en cualquier caso**: contenido marcado por los sistemas automáticos de seguridad o por obligación legal puede conservarse hasta 2 años.
- La Console y el Playground no están cubiertos por ZDR: **no pegar ahí datos reales**.

### 6.2 Qué datos saldrían y cuáles no

| Sí (con GO-IA-5/6)                                                           | Nunca                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Copy publicado por la marca, formato, red, fecha, métricas agregadas         | Comentarios, autores de comentarios, mensajes directos (política piloto) |
| Contexto de Brand Brain autorizado (objetivos, pilares, campañas)            | Datos de pacientes o información de salud de personas                    |
| Imagen de la publicación (portada) por URL o en memoria, sin copia a Storage | Credenciales, tokens de Metricool, datos de usuarios de Hey Foxy         |
| Pregunta del usuario en Ask Foxy (con aviso en el panel)                     | Documentos estratégicos reales (hasta la Brand Knowledge Library + GO)   |

### 6.3 Decisiones de privacidad recomendadas

- **Retención por defecto (sin ZDR) es suficiente para el piloto**: solo sale contenido ya publicado por la marca. ZDR se puede pedir al equipo comercial de Anthropic si MedPlus lo exige; no es requisito técnico.
- **HIPAA readiness / BAA: no activarlo ahora.** Está pensado para información de salud protegida (PHI), que Foxy no envía. Es permanente para la organización y bloquea las funciones no elegibles; si algún día hiciera falta, debe ir en una organización de Anthropic separada.
- **Colombia**: el contenido es público y de la marca, pero el envío a un encargado en el exterior debe constar en el acuerdo con MedPlus (Ley 1581 de 2012, transferencia/transmisión internacional). Confirmarlo con el responsable legal de MediaFOX antes de GO-IA-5.
- **Consentimiento de MedPlus**: autorización escrita para procesar su contenido publicado con un proveedor de IA externo (ampliación del doc 20).

## 7. Análisis multimodal de publicaciones (GO-IA-6)

| Tema           | Cómo se habilitará                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qué se analiza | Imagen de portada de cada publicación (JPEG, PNG, GIF o WebP) junto al copy y al Brand Brain: concepto visual, legibilidad, presencia de marca, coherencia con pilar y tono                    |
| Cómo se envía  | Bloque `image` con fuente `url` (la URL vigente de Metricool) o, si la URL no es accesible, descarga en memoria del servidor y envío en base64. **Sin copiar a Storage** (restricción vigente) |
| URLs caducadas | Si la vista previa caducó, no se analiza y se dice (igual que hoy en el visor); se reintenta tras la siguiente sincronización autorizada                                                       |
| Reels y video  | La API no analiza video: se usa la portada y se declara «análisis de la portada, no del video»                                                                                                 |
| Carruseles     | Metricool solo entrega la portada: se declara «solo portada»                                                                                                                                   |
| Límites        | Máx. 8 000×8 000 px y 10 MB por imagen; el adaptador reduce a ≤ 1 568 px de lado largo para contener costo (≈ 1 000–1 600 tokens)                                                              |
| Costo          | ≈ US$0,004 por imagen con Sonnet 5.5; se analiza una vez por hash de imagen + copy (caché 0007)                                                                                                |
| Control        | Solo organizaciones de `HF_AI_MULTIMODAL_ORGS`; sin personas identificables como objetivo del análisis (no se describe a pacientes ni se infieren datos de salud de personas en las imágenes)  |

## 8. GO independientes necesarios (en orden)

| GO      | Qué autoriza                                                                                                                           | Requisito previo                                   | Costo         |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------- |
| GO-IA-0 | Esta arquitectura: Anthropic, modelos por tarea, API REST, sin Batch, presupuestos de §4.2                                             | Esta guía                                          | 0             |
| GO-IA-1 | WO de desarrollo del adaptador REST (local, `fetch` simulado, streaming en el panel lateral, registro de costo, pruebas)               | GO-IA-0                                            | 0             |
| GO-IA-2 | Crear organización/workspace/clave en Anthropic (lo hace Álvaro) y las variables de §3.2 en Preview; desplegar el Preview por SHA      | GO-IA-1 terminado y Preview validado **sin** clave | Crédito US$25 |
| GO-IA-3 | Pruebas en vivo con datos sintéticos (Clínica Aurora y Banco Horizonte), tope US$5                                                     | GO-IA-2                                            | ≤ US$5        |
| GO-IA-4 | Condiciones de datos: autorización escrita de MedPlus, revisión legal (Ley 1581), decisión sobre ZDR                                   | Puede ir en paralelo a GO-IA-1/3                   | 0             |
| GO-IA-5 | Datos reales de MedPlus, **solo texto** (copy, métricas, Brand Brain): `HF_AI_REAL_DATA_ORGS` = UUID de MedPlus; presupuesto US$15/mes | GO-IA-3 aceptado y GO-IA-4                         | ≈ US$5–9/mes  |
| GO-IA-6 | Multimodal en MedPlus: `HF_AI_MULTIMODAL_ORGS`                                                                                         | GO-IA-5 estable una semana                         | ≈ +US$1/mes   |
| GO-IA-7 | Brand Knowledge Library con documentos reales (§9)                                                                                     | WO propia + GO-IA-5                                | Por definir   |

Siguen vigentes y fuera de estos GO: sin comentarios reales, sin WhatsApp, sin sincronización automática, sin Production, sin cambios en MediaFOX OS ni MOVOS.

## 9. Procedimiento para incorporar la estrategia orgánica real de MedPlus

Hoy Brand Brain de MedPlus está vacío a propósito. Cuando haya GO:

1. **Autorización**: MedPlus entrega por escrito qué documentos y qué decisiones estratégicas se pueden cargar y quién en MedPlus las valida.
2. **Primera carga, manual (sin IA)**: un responsable de MediaFOX con rol owner/admin completa el formulario de Brand Brain («Empieza por lo esencial»: objetivos, pilares, campañas activas, tono, públicos, restricciones). Cada guardado crea una versión con autor (0007). Fuente: los documentos autorizados, citados por nombre y página en el propio campo.
3. **Revisión**: el responsable de MedPlus revisa la versión en Preview; los cambios se guardan como nueva versión. Foxy no modifica la estrategia.
4. **Uso por Foxy**: con GO-IA-5, el contexto validado entra en el prompt (en caché) y las respuestas citan el objetivo, pilar o campaña que usan.
5. **Después (Brand Knowledge Library, GO-IA-7)**: los documentos se suben a una biblioteca aislada por organización; Foxy propone extracciones con referencia a documento y página, y una persona las aprueba antes de que pasen al conocimiento estructurado (doc 00).

La guía detallada de campos está en el doc [23](./23_BRAND_BRAIN_MEDPLUS_GUIDE.md).

## 10. Lo que no cambia con esta guía

Sin proveedor activado, sin claves, sin llamadas con costo, sin datos reales enviados, sin documentos estratégicos cargados, sin sincronizar Metricool, sin comentarios ni WhatsApp, sin cambios en Production, MediaFOX OS ni MOVOS. Gate D abierto.

Fuentes oficiales: [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) · [Vision](https://platform.claude.com/docs/en/build-with-claude/vision) · [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) · [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) · [Migración a la versión 2026-10-21](https://platform.claude.com/docs/en/api/migration-2026-10-21) · [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) · [PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)
