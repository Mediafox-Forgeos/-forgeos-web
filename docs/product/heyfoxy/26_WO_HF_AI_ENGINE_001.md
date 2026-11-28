# 26 — WO-HF-AI-ENGINE-001: Foxy Intelligence Engine con IA generativa (GO-IA-0 + GO-IA-1)

| Propiedad | Valor                                                                                                                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fecha     | 2026-11-27                                                                                                                                                                                          |
| Estado    | **Implementada en local; GO-IA-2 completado** (doc 27): 0009 aplicada en heyfoxy-qa, clave y variables en Preview, Preview `8cfd701` con el proveedor apagado. Ninguna llamada real. Gate D abierto |
| GO        | GO-IA-0 (arquitectura del doc 25) y GO-IA-1 (desarrollo local), autorizados por Álvaro                                                                                                              |
| Capturas  | `/Volumes/MediaFOX_DEV/QA/HeyFoxy/V2/2026-11-27/ai-engine-001/` (fuera de Git, con fixtures sintéticos)                                                                                             |

## 1. Verificación de modelos y tarifas (2026-11-27)

Fuentes oficiales: [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) y [Pricing](https://platform.claude.com/docs/en/about-claude/pricing).

| Nivel    | Modelo            | ID exacto           | Estado                          | Entrada / salida (US$/MTok)                 | Lectura de caché | Retiro, no antes de |
| -------- | ----------------- | ------------------- | ------------------------------- | ------------------------------------------- | ---------------- | ------------------- |
| FAST     | Claude Haiku 5.5  | `claude-haiku-5-5`  | Vigente, disponibilidad general | 0,10 / 0,50 (≤ 100 000) · 0,50 / 2,50 (más) | 0,01             | 2027-10-07          |
| CONTENT  | Claude Sonnet 5.5 | `claude-sonnet-5-5` | Vigente, disponibilidad general | 2 / 10                                      | 0,10             | 2027-09-28          |
| STRATEGY | Claude Opus 5.5   | `claude-opus-5-5`   | Vigente, disponibilidad general | 4 / 20                                      | 0,20             | 2027-09-22          |

- **Versión de API:** `anthropic-version: 2026-10-21`. Con ella no se envían `temperature`, `top_p` ni `top_k`, y no se usa prefill.
- **Discrepancias:** ninguna respecto al doc 25. Dos precisiones ya aplicadas en el código:
  - El esfuerzo por defecto de Sonnet 5.5 es `high`; el adaptador lo fija explícitamente en `medium`.
  - La lectura de caché de Sonnet y Opus 5.5 cuesta 0,05× del precio de entrada.
- **Catálogo:** los identificadores y precios están en `lib/intel/ai/catalog.ts`.
  - Un modelo configurado que no esté en el catálogo bloquea la IA generativa con el motivo «sin verificar».
  - Los modelos se cambian por variable de entorno, sin tocar código.

## 2. Arquitectura implementada

| Pieza                                     | Archivo (`apps/heyfoxy-web`)                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Catálogo verificado, precios y costo      | `lib/intel/ai/catalog.ts`                                                                                                      |
| Configuración (variables, validación)     | `lib/intel/ai/config.ts`                                                                                                       |
| Contrato de proveedor intercambiable      | `lib/intel/ai/provider.ts`                                                                                                     |
| Adaptador Anthropic por API REST          | `lib/intel/ai/anthropic.ts` + `sse.ts`                                                                                         |
| Proveedor de fixtures (solo desarrollo)   | `lib/intel/ai/fixture.ts`                                                                                                      |
| Contexto verificado con referencias E1…En | `lib/intel/ai/context.ts`                                                                                                      |
| Minimización y datos sensibles            | `lib/intel/ai/redact.ts`                                                                                                       |
| Reglas de negocio sobre la salida         | `lib/intel/ai/rules.ts`                                                                                                        |
| Content Intelligence generativo           | `lib/intel/ai/content.ts`                                                                                                      |
| Ask Foxy generativo (streaming)           | `lib/intel/ai/ask.ts`, `answer.ts`, `app/api/foxy/ask/route.ts`                                                                |
| Multimodal y protección SSRF              | `lib/intel/ai/media.ts`                                                                                                        |
| Presupuesto, reservas y consumo           | `lib/intel/ai/budget.ts`, `supabase-stores.ts`                                                                                 |
| Ensamblado y estado público               | `lib/intel/ai/runtime.ts`, `engine.ts`, `scope.ts`                                                                             |
| Migración 0009 (solo local)               | `supabase/migrations-pending/20261127000900_hf_ai_engine.sql` (+ rollback, `tests/sql/43_…`, `scripts/test-migration-0009.sh`) |

- **Sin dependencias nuevas.** Se usa `fetch` nativo; el lockfile compartido, MediaFOX OS y MOVOS no se tocaron.
- **Reparto de trabajo:**
  - El código calcula: métricas, indicadores, medianas, comparaciones dentro de la misma red y formato, tamaños de muestra, rendimiento verificado, estado estratégico, reputación y costo.
  - El modelo interpreta: copy, concepto, hook, CTA, intención, objetivo probable, análisis visual, alineación, oportunidades, recomendaciones, pruebas A/B y conversación.
  - El modelo nunca recibe un número para calcular otro.

## 3. Foxy Content Intelligence

- Se ejecuta **bajo demanda**, porque tiene costo. Lo inicia el botón «Analizar con IA generativa», disponible para owner, admin y analyst.
  - La reserva de presupuesto se hace antes de llamar al modelo.
  - El resultado queda en caché. La clave de caché combina el contexto, la versión de Brand Brain, la versión de las instrucciones, el modelo y la cobertura visual.
- **Salida estructurada** (`output_config.format`). Se valida en dos pasos: el esquema de la API y después zod.
- **Fusión con la base determinística.** Si el modelo no aporta hallazgos de un área, se conservan los del motor local.
- **Reglas aplicadas por código** (`rules.ts`):

| Situación en la salida del modelo                | Qué hace el código                                     |
| ------------------------------------------------ | ------------------------------------------------------ |
| Referencia que no está en el contexto            | Se descarta y se cuenta                                |
| Hecho sin evidencia                              | Se descarta                                            |
| Comparación entre redes                          | Se descarta                                            |
| Sentimiento atribuido sin comentarios importados | Se descarta                                            |
| Afirmación causal                                | Se convierte en hipótesis                              |
| Recomendación con muestra menor de 3             | Se convierte en hipótesis, con la limitación explícita |
| Pilar o campaña que no existe en Brand Brain     | Se descarta                                            |
| Hallazgo estratégico sin Brand Brain             | Se descarta                                            |

- Todo lo descartado o ajustado se muestra en «Verificación aplicada por Hey Foxy».

## 4. Foxy Multimodal Intelligence (preparado)

- **Cobertura declarada:**
  - imagen completa;
  - portada de carrusel («1 de N»);
  - miniatura de video («no el video completo»);
  - imagen no disponible;
  - imagen caducada.
- **Descarga segura en memoria.** Nunca se guarda en Storage. Controles:
  - solo HTTPS y solo dominios de la CDN de Meta;
  - sin IP literales, credenciales ni puertos en la URL;
  - DNS comprobado contra rangos privados;
  - redirecciones revalidadas;
  - tipo MIME y firma binaria verificados;
  - 5 MB y 8 s como máximo.
- **Riesgo residual documentado:** DNS rebinding entre la comprobación y la conexión. La lista cerrada de dominios lo hace impracticable.
- **Autorización:** solo entrada sintética o una organización incluida en `HF_AI_MULTIMODAL_ORGS` (vacía).
- **Pruebas:** solo con imágenes sintéticas generadas en las propias pruebas.

## 5. Ask Foxy generativo

- **Cobertura:** las tres vistas usan `/api/foxy/ask` con streaming NDJSON: general, lateral y contextual por publicación.
- **Seguridad del endpoint:** exige sesión, mismo origen y membresía real. El contexto se reconstruye en el servidor con:
  - organización, publicación, red, periodo y filtros;
  - métricas verificadas;
  - Brand Brain autorizado;
  - las últimas 4 vueltas de la conversación, saneadas.
- **Estructura de la respuesta:**
  1. respuesta principal;
  2. interpretación;
  3. evidencias desplegables;
  4. recomendaciones con su evidencia;
  5. limitaciones;
  6. preguntas de seguimiento.
- **Experiencia:**
  - se muestra por partes mientras llega;
  - «Detener respuesta» cancela también la llamada al proveedor;
  - se contemplan errores de conexión, tiempo agotado, límite de consumo, respuestas incompletas y declinadas.
- **Respaldo:** cuando no hay IA generativa, o falla, responde el motor local identificado.

## 6. Foxy Brand Brain

- **Fuente:** solo el contexto de la organización activa. Un dato de otra organización hace fallar la construcción con `IsolationError`; no se filtra en silencio.
- **Contenido usado:** identidad, posicionamiento, propuesta de valor, objetivos, pilares, audiencias, insights, campañas activas, tono, lineamientos visuales, indicadores y **solo los aprendizajes aprobados**.
- **Trazabilidad:** la versión de Brand Brain queda registrada en cada análisis y en `ai_usage`.
- **Análisis desactualizado:** si cambia el Brand Brain o los datos, el análisis se marca como desactualizado («Se generó con Brand Brain v2; la vigente es v3») y se ofrece actualizarlo.
- **Sin cambios automáticos:** Foxy no modifica la estrategia. La Brand Knowledge Library sigue documentada como evolución futura (HF-BB-04).

## 7. Control de costos

- **Reserva antes de cada llamada:** se reserva el costo máximo previsible (entrada estimada más `max_tokens` completo).
- **Bloqueos.** La llamada no se hace si se da alguno de estos casos:
  - interruptor de emergencia activo (`HF_AI_KILL_SWITCH` o `ai_kill_switch`);
  - presupuesto mensual agotado. Se usa el menor entre `usage_budgets` y `HF_AI_ORG_MONTHLY_CAP_USD`, que es 15 por defecto;
  - tope total de pruebas sintéticas alcanzado (US$5);
  - límite diario por usuario alcanzado (40);
  - límite de ítems diarios de la organización alcanzado;
  - 2 llamadas simultáneas por organización ya en curso;
  - solicitud duplicada.
- **Liquidación:** se hace con el costo real calculado por código a partir del `usage` del proveedor, con modelo, tarea, tokens (incluida la caché), estado, versión de Brand Brain y de instrucciones. Una cancelación se registra con el uso recibido.
- **Respaldo registrado:** cada uso del motor local cuando la IA estaba habilitada queda anotado.
- **Persistencia:**
  - demo: en memoria;
  - Supabase: migración **0009** (solo local). Reserva atómica bajo bloqueo por organización y funciones solo para el service role.
  - Prueba de 0009: 17 aserciones y rollback exacto a 0008.
- **Visibilidad:** «Uso y presupuestos» muestra:
  - el motor y los modelos verificados;
  - si la clave está configurada (nunca su valor);
  - si hay autorizaciones de datos reales y de imágenes;
  - gastado, reservado y límite;
  - solicitudes, caché, respaldos, errores y tokens;
  - el consumo por tarea y por modelo.

## 8. Privacidad, seguridad y requisitos legales

- **Solo servidor.** Las llamadas salen únicamente desde el servidor (`server-only`); el navegador no ve la clave ni las tablas de consumo.
- **Minimización por capas** (no basta un filtro de palabras):
  1. lista blanca de campos: sin comentarios, autores, usuarios ni credenciales;
  2. redacción de correos, teléfonos, documentos, tokens, consultas de URL y menciones a cuentas ajenas;
  3. detección de relatos personales de salud (estructura más vocabulario): con datos reales no se envían;
  4. autorización por organización (`HF_AI_REAL_DATA_ORGS` vacía).
- **Prompt injection:** el copy, la pregunta y los aprendizajes son datos no confiables. Se neutralizan, se delimitan y las instrucciones del sistema lo dicen. Una referencia inventada no sobrevive a la validación.
- **Registros:** sin contenido. Solo modelo, estado, tokens, id de solicitud y el id del proveedor.
- **Condiciones de Anthropic** (verificadas el 27-11 en «API and data retention»):

| Tema                  | Qué dice la documentación                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrenamiento         | No se usa para entrenar sin permiso expreso                                                                                                     |
| Retención por defecto | El contenido no se conserva, salvo en los Covered Models (Fable y Mythos), que no se usan                                                       |
| Excepciones           | Salida estructurada: el esquema se guarda 24 h. Batch: 29 días, no se usa. Contenido marcado por seguridad o por obligación legal: hasta 2 años |
| Eliminación y ZDR     | Se solicitan al equipo comercial                                                                                                                |

«No se usa para entrenar» **no equivale a retención cero**.

- **HIPAA y BAA:** no se activan.
- **Requisitos legales antes de usar información real** (para validar con el responsable legal de MediaFOX; no es asesoría legal):
  1. autorización escrita de MedPlus para procesar su contenido publicado con un encargado externo;
  2. transmisión internacional de datos según la Ley 1581 de 2012 y el Decreto 1377 de 2013, con contrato de transmisión o cláusulas con el encargado;
  3. actualización del aviso o la política de tratamiento si aplica;
  4. confirmar que no se envían datos personales de pacientes ni comentarios;
  5. registro de la decisión en el doc 20.

## 9. Activación: variables exactas de Vercel y procedimiento

Todas las variables van **solo en Preview**, como **Sensitive**. No se crean en Production ni en Development, y tampoco `HF_AI_PROVIDER` ni `OPENAI_API_KEY`.

| Variable                    | Valor                                 | Cuándo                                        |
| --------------------------- | ------------------------------------- | --------------------------------------------- |
| `HF_MIGRATION_0009_APPLIED` | `true`                                | GO-IA-2, tras aplicar 0009                    |
| `ANTHROPIC_API_KEY`         | Clave del workspace `heyfoxy-preview` | GO-IA-2 (la carga Álvaro)                     |
| `HF_AI_MODEL_FAST`          | `claude-haiku-5-5`                    | GO-IA-2 (opcional: es el valor por defecto)   |
| `HF_AI_MODEL_CONTENT`       | `claude-sonnet-5-5`                   | GO-IA-2 (opcional)                            |
| `HF_AI_MODEL_STRATEGY`      | `claude-opus-5-5`                     | GO-IA-2 (opcional)                            |
| `HF_AI_ORG_MONTHLY_CAP_USD` | `15`                                  | GO-IA-2                                       |
| `HF_AI_SYNTHETIC_CAP_USD`   | `5`                                   | GO-IA-2                                       |
| `HF_AI_CONTENT_PROVIDER`    | `anthropic`                           | **GO-IA-3** (es lo que enciende las llamadas) |
| `HF_AI_REAL_DATA_ORGS`      | No crear (vacía)                      | GO-IA-5                                       |
| `HF_AI_MULTIMODAL_ORGS`     | No crear (vacía)                      | GO-IA-6                                       |

**Clave:** la creas tú en https://platform.claude.com, en la organización corporativa de MediaFOX (no en una cuenta personal), y nunca pasa por el chat.

1. Workspace `heyfoxy-preview`, con límite de gasto de US$25 al mes.
2. Crédito prepago de US$25, sin recarga automática.
3. _API Keys_ → _Create Key_ dentro del workspace.
4. Pegarla en Vercel → heyfoxy-web → _Settings_ → _Environment Variables_ → Preview → Sensitive. Alternativa en esta sesión: `! vercel env add ANTHROPIC_API_KEY preview --sensitive --scope mediafox`.

**Procedimiento GO-IA-2 (sin ninguna llamada a Anthropic):**

1. Aplicar 0009 en heyfoxy-qa con el mismo protocolo que 0008:
   - verificar historial y hash;
   - tomar la huella de los datos;
   - ejecutar la batería remota revertida;
   - comprobar que no quedan residuos.
2. Crear `HF_MIGRATION_0009_APPLIED`.
3. Fijar presupuesto de US$2,50 para Clínica Aurora y Banco Horizonte en `usage_budgets`.
4. Cargar la clave y las variables de GO-IA-2, sin `HF_AI_CONTENT_PROVIDER`.
5. Desplegar el Preview protegido del SHA aprobado con `deploy-preview.sh`.
6. Verificar en «Uso y presupuestos»:
   - el motor sigue en «Motor local por reglas»;
   - la clave figura como «Configurada (valor oculto)»;
   - los modelos aparecen como verificados.

**GO-IA-3:**

1. Crear `HF_AI_CONTENT_PROVIDER=anthropic` y volver a desplegar.
2. Hacer las 20 ejecuciones sintéticas del doc 25 §5, con el tope de US$5.

## 10. Experiencia (Design System v0.5)

- **Estados:** EngineBadge, AiStateNotice, FallbackNotice, BrandContextNotice, MediaCoverageNote, AdjustmentsNote, GenerativeAnalysisControl, ConversationalAnswer y AskBox con «Detener».
- **Cobertura:** los diez estados de la WO, en claro y oscuro.
- **Uso y presupuestos:** con el consumo de IA generativa.
- **Refinamientos pendientes** de la revisión anterior siguen en TECH_BACKLOG: HF-UX-22 a 24 y HF-MC-04.
  - HF-AI-14 (respuesta conversacional) y HF-AI-15 (muestra insuficiente) quedan **resueltos en el motor generativo**.

## 11. Pruebas (local, sin red ni costo)

| Suite                     | Resultado                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Unitarias (vitest)        | **270 superadas**, 4 omitidas; **52 nuevas** del motor (`tests/ai-engine.test.ts`), con un guardián que hace fallar cualquier `fetch` real |
| Tipos, ESLint, Prettier   | Sin errores                                                                                                                                |
| Migración 0009            | 17 aserciones, idempotente, rollback exacto a 0008, reaplicable                                                                            |
| Compilación de producción | Correcta (`next build` + `check-trace`)                                                                                                    |
| Playwright (8 proyectos)  | **198 superadas, 0 fallidas**; 3 nuevas (`e2e/ai-engine.spec.ts`)                                                                          |
| Accesibilidad (axe)       | 0 violaciones graves nuevas; deuda conocida sin cambios                                                                                    |
| Regresión visual          | 3 referencias del tema clásico regrabadas tras revisión (`uso.png`: sección nueva). El resto, sin cambios                                  |

**Cobertura de las pruebas unitarias:**

- **Modelos y configuración:** selección de modelos, configuración, IDs no verificados, fixtures bloqueados en producción, interruptor, tarifas y costo.
- **Adaptador REST:** cabeceras y cuerpo, reintentos, errores HTTP, tiempo agotado, refusal y corte, streaming fragmentado, cancelación.
- **Contexto:** aislamiento entre organizaciones, minimización y prompt injection, datos sensibles.
- **Reglas sobre la salida:** evidencia inventada, comparaciones entre redes, muestra insuficiente.
- **Brand Brain:** versionado y detección de análisis desactualizado.
- **Costos:** caché, presupuesto, concurrencia, duplicados, respaldo.
- **Multimodal:** URLs maliciosas y SSRF, firmas y tamaños, cobertura multimodal.
- **Ask Foxy:** streaming completo, cancelación y error con respaldo.

## 12. Capturas (fixtures sintéticos, servidor local en modo demo)

`/Volumes/MediaFOX_DEV/QA/HeyFoxy/V2/2026-11-27/ai-engine-001/` (30 archivos, índice en `INDICE.md`). Cubren:

- **Detalle:** IA disponible, generando, completado a 1440, 1536, 820 y 390, y primera pantalla.
- **Copiloto:** abierto, en streaming, cancelado, completo con evidencia, error con respaldo y cerrado, a 1440, 1536 y 390.
- **Otras vistas:** Ask Foxy general en oscuro, contexto estratégico insuficiente, uso y presupuestos, presupuesto agotado (detalle y copiloto) y motor local.

Ninguna tiene errores de consola ni desbordamiento horizontal. La referencia de «antes» son las capturas de `2026-11-26/ux-refinement-002/despues` (solo motor local).

## 13. Pendientes y limitaciones

- **Proveedor no activado:** ninguna llamada real. El adaptador se validó contra respuestas grabadas con la forma documentada de la API. La primera llamada real será en GO-IA-3.
- **Tareas FAST y STRATEGY:** están configuradas y verificadas, pero aún no tienen flujo propio en la interfaz. Pendiente:
  - etiquetado masivo con Haiku;
  - informe estratégico con Opus.

  Hoy Content Intelligence y Ask Foxy usan CONTENT (Sonnet).

- **Imágenes:** no se redimensionan, porque no hay librería sin dependencias nuevas. Se confía en el redimensionado de la API y se reserva el costo máximo de 4 784 tokens visuales por imagen.
- **Conversación:** se conserva en la sesión del navegador, no en la base.
- **Cancelación:** la de Ask Foxy está implementada; el análisis de contenido no se puede cancelar desde la interfaz (tiempo máximo de 45 s).
- **Concurrencia:** en demo es por proceso; en Supabase queda garantizada por 0009.
- **0009** aplicada en heyfoxy-qa el 2026-11-28 (GO-IA-2, doc 27).
- **Panel lateral:** cubre el contenido en escritorio (HF-UX-22, sin cambios).
- **`next build`** muestra un aviso de su paso de ESLint integrado: no encuentra `eslint-plugin-react-hooks` por la resolución del monorepo. ESLint ejecutado directamente está limpio; no se cambiaron dependencias.
- **Capturas en modo desarrollo:** muestran el indicador «N» de Next en la esquina inferior izquierda.

## 14. Siguiente paso

Detenido aquí. Se solicita **GO-IA-2** (sección 9): aplicar 0009 en heyfoxy-qa, cargar la clave y las variables, y desplegar el Preview protegido **sin encender el proveedor**. GO-IA-3 no se inicia sin su propio GO.

**Actualización 2026-11-28:** GO-IA-2 completado. Plan y condiciones de GO-IA-3 en el [doc 27](./27_GO_IA_2_Y_PLAN_GO_IA_3.md).
