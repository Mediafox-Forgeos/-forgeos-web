# 22 — Proveedor de IA para Foxy: arquitectura de modelos por tarea (para GO)

| Propiedad | Valor                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- |
| Fecha     | 2026-11-26                                                                                   |
| Estado    | **Propuesta.** Sin contratar, sin activar, sin llamadas con costo, sin datos reales enviados |
| Fuentes   | Documentación oficial de Anthropic consultada el 2026-11-26 (enlaces al final)               |

> **Actualización 2026-11-27:** la guía de activación, la decisión de integrar por API REST y la retención de datos confirmada están en el doc [25](./25_AI_ACTIVATION_GUIDE.md). La duda del §5 queda resuelta: la Messages API no conserva por defecto el contenido de las conversaciones, salvo en los Covered Models (Fable y Mythos), que exigen 30 días. Batch, en cambio, lo conserva 29 días, por lo que el piloto no lo usa.

Hoy Foxy funciona con un **motor local por reglas** (doc 21). Este documento prepara la activación de un proveedor de IA generativa sin asumir que un solo modelo sirve para todo.

## 1. Modelos verificados (documentación oficial)

| Rol                          | Modelo            | ID de API           | Entrada / salida (US$ por millón de tokens) | Lectura de caché | Latencia relativa | Visión | Contexto / salida máx. |
| ---------------------------- | ----------------- | ------------------- | ------------------------------------------- | ---------------- | ----------------- | ------ | ---------------------- |
| Económico, tareas frecuentes | Claude Haiku 5.5  | `claude-haiku-5-5`  | 0,10 / 0,50 (prompts ≤ 100 000 tokens)      | 0,01             | La más rápida     | Sí     | 1M / 128K              |
| Multimodal, contenido        | Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2 / 10                                      | 0,10             | Rápida            | Sí     | 1M / 128K              |
| Avanzado, estrategia         | Claude Opus 5.5   | `claude-opus-5-5`   | 4 / 20                                      | 0,20             | Moderada          | Sí     | 1M / 128K              |

- Los tres son modelos vigentes y de disponibilidad general; su retiro no será antes de septiembre u octubre de 2027.
- Batch API: 50 % de descuento para tareas no interactivas.
- Imágenes: cuestan `⌈ancho/28⌉ × ⌈alto/28⌉` tokens visuales. Una pieza de Instagram de 1080×1350 son unos **1 911 tokens**; reducida a 1000 px de lado largo, unos 1 300. Se pueden enviar por URL.
- Todos admiten respuestas estructuradas (`output_config.format`) y streaming.

## 2. Arquitectura recomendada por tarea

| Tarea de Foxy                                                                                       | Modelo     | Por qué                                                                               | Costo estimado por unidad                            |
| --------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Etiquetado de cada publicación: temática, formato, hook, CTA, pilar candidato (salida estructurada) | Haiku 5.5  | Alto volumen, baja latencia; la salida se valida con el esquema de `lib/intel/schema` | ≈ US$0,0004                                          |
| Análisis de contenido con imagen: concepto visual, coherencia con el tono y la marca                | Sonnet 5.5 | Visión con buena relación calidad/costo                                               | ≈ US$0,025 (texto + 1 imagen ≈ 5 000 + 1 500 tokens) |
| Ask Foxy conversacional (streaming)                                                                 | Sonnet 5.5 | Respuesta rápida; Brand Brain y prompt de sistema en caché (lectura a 0,05×)          | ≈ US$0,014 por pregunta                              |
| Análisis estratégico: informe mensual, cruce de histórico, Brand Brain y campañas, brief creativo   | Opus 5.5   | Razonamiento más profundo; poco frecuente; por Batch cuando no es interactivo         | ≈ US$0,12 por informe (Batch)                        |

Ningún modelo recibe comentarios reales (política del piloto). El motor local sigue como respaldo si se agota el presupuesto o se activa el interruptor.

## 3. Estimación mensual del piloto MedPlus

| Concepto                                                             | Volumen | Costo             |
| -------------------------------------------------------------------- | ------- | ----------------- |
| Etiquetado (Haiku)                                                   | 40      | US$0,02           |
| Análisis de contenido con imagen (Sonnet; solo si la entrada cambió) | 40      | US$1,00           |
| Ask Foxy (Sonnet)                                                    | 300     | US$4,20           |
| Informes estratégicos (Opus, Batch)                                  | 4       | US$0,50           |
| **Total**                                                            |         | **≈ US$6 al mes** |

El presupuesto por organización ya existe (`usage_budgets`, US$30 al mes por defecto, con corte duro), igual que el registro de consumo (`ai_usage`). La caché por hash (`content_intel_cache`, 0007) evita reanalizar lo que no cambió.

## 4. Integración

| Opción                                            | Evaluación                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SDK oficial `@anthropic-ai/sdk`** (recomendada) | Tipos, reintentos, errores tipados, utilidades de streaming y respuestas estructuradas. **Problema detectado:** instalarlo en el monorepo añade `@opentelemetry/api` y cambia la resolución de `next` de MediaFOX OS y MOVOS en el lockfile compartido. Antes de instalarlo hace falta la autorización de sus responsables y comprobar sus compilaciones. El cambio no sube la versión de `next`; solo añade una dependencia opcional |
| API REST directa (`fetch` a `/v1/messages`)       | Técnicamente viable y sin tocar el lockfile. Hay que reimplementar a mano reintentos, errores, streaming SSE y tipos. Solo como alternativa si no se autoriza el SDK                                                                                                                                                                                                                                                                  |
| SDK aislado en un servicio aparte                 | Separa la dependencia, pero añade otro despliegue que mantener. No compensa en el piloto                                                                                                                                                                                                                                                                                                                                              |

Diseño ya preparado:

- Proveedor intercambiable y decisión de proveedor en `lib/intel/guard`.
- Texto externo delimitado y neutralizado.
- Validación de la salida con zod y descarte de evidencia que no estaba en la entrada.
- Interruptores `HF_AI_KILL_SWITCH` y `ai_kill_switch`.
- Datos reales solo para las organizaciones de `HF_AI_REAL_DATA_ORGS`.

## 5. Tratamiento y retención de datos (a confirmar antes del GO de datos reales)

- Las fuentes oficiales describen la retención por defecto de la API de forma distinta según el documento: sin retención salvo los «Covered Models», o retención estándar de 30 días. **Hay que confirmarla con Anthropic.**
- Los modelos con retención obligatoria de 30 días son las familias Fable y Mythos, no los propuestos aquí.
- **Zero Data Retention** se solicita por organización al equipo comercial de Anthropic; aun así, se conservan los resultados de los clasificadores de seguridad.
- Para contenido relacionado con salud existe un **Business Associate Agreement** para clientes comerciales. Valorarlo con MedPlus aunque no se envíen comentarios ni datos de pacientes.
- La Console y el Playground no están cubiertos por ZDR: no usarlos con datos reales.

## 6. Variables para activar (Preview, solo servidor)

| Variable                 | Valor                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| `HF_AI_CONTENT_PROVIDER` | `anthropic`                                                        |
| `ANTHROPIC_API_KEY`      | Clave de la organización de MediaFOX (Sensitive)                   |
| `HF_AI_MODEL_FAST`       | `claude-haiku-5-5`                                                 |
| `HF_AI_MODEL_CONTENT`    | `claude-sonnet-5-5`                                                |
| `HF_AI_MODEL_STRATEGY`   | `claude-opus-5-5`                                                  |
| `HF_AI_REAL_DATA_ORGS`   | Vacía hasta el GO de datos reales                                  |
| `HF_AI_KILL_SWITCH`      | No crear salvo emergencia (inmediato: `ai_kill_switch` en la base) |

## 7. Secuencia de GO propuesta

1. Autorización de los responsables de MediaFOX OS y MOVOS para el cambio del lockfile, con sus compilaciones verificadas. Alternativa: la API REST.
2. Adaptador con fixtures sintéticos y costos medidos, con tope de US$5.
3. Confirmar retención (y ZDR o BAA si procede) con Anthropic.
4. GO de datos reales de MedPlus: solo publicaciones propias, métricas y Brand Brain, nunca comentarios.

Fuentes: [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) · [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) · [Vision](https://platform.claude.com/docs/en/build-with-claude/vision) · [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) · [ZDR: productos cubiertos](https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to) · [Covered Models](https://support.claude.com/en/articles/15425695-covered-models) · [BAA para clientes comerciales](https://privacy.claude.com/en/articles/8114513-business-associate-agreements-baa-for-commercial-customers)
