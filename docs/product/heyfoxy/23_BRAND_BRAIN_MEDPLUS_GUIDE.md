# 23 — Guía para alimentar Foxy Brand Brain (MedPlus)

> Hey Foxy es el copiloto de inteligencia estratégica para directores de marca y equipos de marketing. Brand Brain es lo que le permite **conocer** la estrategia de cada marca, para que sus recomendaciones no sean genéricas.

**Importante:** cargar información estratégica real de MedPlus **requiere autorización específica**. Hasta entonces, Brand Brain de «MedPlus · Piloto QA» queda vacío y Foxy lo indica en lugar de inventar.

## 1. Quién y cómo

- **Quién:** un owner o admin de la organización (MediaFOX). Los demás roles solo leen.
- **Dónde:** Hey Foxy → menú **Foxy** → **Foxy Brand Brain**.
- **Trazabilidad:** cada vez que se guarda, sube la versión y queda registrado quién la hizo.
- **Foxy nunca modifica la estrategia.** Lo que Foxy aprende se guarda como **propuesta** en la memoria estratégica, hasta que una persona la valida.

## 2. Qué preparar (MediaFOX, con la estrategia orgánica de MedPlus)

| Sección en Hey Foxy                                           | Qué escribir                                                                                       | Formato                                                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Identidad · Descripción                                       | Qué es MedPlus Medicina Prepagada y para quién                                                     | 2–4 frases                                                                              |
| Identidad · Propuesta de valor, posicionamiento, personalidad | Lo aprobado en la estrategia                                                                       | Texto breve                                                                             |
| Identidad · **Tono de comunicación**                          | Resumen del manual de tono: cómo habla la marca, qué evita                                         | 3–6 frases                                                                              |
| Identidad · Lineamientos visuales                             | Lineamientos creativos: colores, uso de personas, tipografía, estilo                               | Texto breve                                                                             |
| Identidad · Manual de marca                                   | **Referencia** al documento (nombre o ubicación). No se carga el archivo                           | Una línea                                                                               |
| Estrategia · **Estrategia orgánica**                          | Enfoque orgánico 2026 (síntesis)                                                                   | Hasta 1 500 caracteres                                                                  |
| Estrategia · Objetivos de negocio y de comunicación           | Incluye los **objetivos por red social** (p. ej. «Instagram: alcance de contenidos de prevención») | Uno por línea                                                                           |
| Estrategia · **Pilares de contenido**                         | Cada pilar con palabras clave que aparecen en los copys (Foxy reconoce el pilar por ellas)         | Una línea por pilar: `Nombre \| descripción \| palabra1, palabra2`                      |
| Estrategia · **Audiencias**                                   | Segmentos prioritarios                                                                             | Uno por línea                                                                           |
| Estrategia · Insights del consumidor                          | Hallazgos que guían la comunicación                                                                | Uno por línea                                                                           |
| Estrategia · **Indicadores prioritarios**                     | KPI de la estrategia (alcance, engagement, guardados…)                                             | Uno por línea                                                                           |
| Estrategia · Competidores                                     | Marcas de referencia                                                                               | Uno por línea                                                                           |
| **Campañas**                                                  | Activas e históricas                                                                               | Una línea por campaña: `Nombre \| activa o pasada \| concepto \| objetivos \| mensajes` |

**Consejo:** las palabras clave de los pilares deben ser las que de verdad usan los copys de MedPlus (por ejemplo «prevención», «chequeo», «afiliado»). Así Foxy asigna el pilar con evidencia.

## 3. Qué no cargar

- Datos de pacientes, historias clínicas ni información de salud de personas.
- Credenciales, tarifas confidenciales o información contractual.
- Documentos completos: por ahora solo referencias (ver §5).

## 4. Qué cambia en Foxy cuando hay contexto

- En el detalle de cada publicación, **Strategic Intelligence** indica el pilar, la campaña y la relación con los objetivos, con evidencia y su limitación.
- **Creative Intelligence** y **Ask Foxy** («¿Está alineado con nuestra estrategia orgánica?», «¿A qué pilar pertenece?») responden con ese contexto.
- La tarjeta de Brand Brain muestra qué campos esenciales faltan.

## 5. Evolución: biblioteca de conocimiento (siguiente etapa)

Objetivo: que Foxy cite documentos estratégicos reales (PDF, presentaciones, manuales, briefs, estudios), con referencia a la fuente, la versión y la fecha.

| Aspecto      | Diseño propuesto                                                                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Almacén      | Bucket privado por organización (patrón de `hf-media`), con RLS por organización                                                                                                                                                             |
| Registro     | Tabla `brand_documents`: título, tipo, fuente, versión, fecha de vigencia, hash del archivo, quién lo cargó, estado (propuesto o aprobado). Las versiones anteriores se conservan                                                            |
| Recuperación | Extracción de texto en servidor y fragmentos con referencia (documento, página, sección). La **búsqueda semántica** (embeddings con pgvector en la misma base) solo cuando el volumen lo justifique; al principio basta con buscar por texto |
| Citas        | La evidencia de Foxy de tipo «documento» enlaza el documento, la página y la versión. Una cita a un documento que no está en la biblioteca se descarta, como ya pasa con las publicaciones                                                   |
| Seguridad    | Ningún documento real sin autorización de MedPlus. Ningún envío a proveedores externos sin GO. Retención definida por documento                                                                                                              |
| Memoria      | Aprendizajes, decisiones, recomendaciones aceptadas o descartadas y resultados de pruebas A/B, siempre con validación humana                                                                                                                 |

Esta evolución requiere su propia WO, la migración correspondiente y GO.
