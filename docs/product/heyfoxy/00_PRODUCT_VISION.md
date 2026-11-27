# 00 — Visión de producto: Hey Foxy

> **Hey Foxy es el copiloto de inteligencia estratégica para directores de marca y equipos de marketing.**

No estamos construyendo otra plataforma de social listening, monitoreo o estadísticas. Hey Foxy conoce la estrategia particular de cada marca, interpreta sus resultados y genera recomendaciones alineadas con sus objetivos de marketing y comunicación.

**Premisa:** Metricool nos dice qué pasó. Hey Foxy nos ayuda a entender qué significa, cómo se relaciona con nuestra estrategia y qué deberíamos hacer después.

## Ciclo del producto

| Etapa           | Qué hace Hey Foxy                                                                        | Hoy (2026-11-27)                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Conocer**     | Foxy Brand Brain: identidad, estrategia, campañas, conocimiento y memoria                | Formulario estructurado, versiones con autor y memoria con revisión humana (0007 y 0008 en QA); Brand Knowledge Library: siguiente |
| **Escuchar**    | Fuentes autorizadas por red y tipo de dato, con cobertura declarada                      | Metricool (Instagram y Facebook, piloto MedPlus); comentarios desactivados por privacidad                                          |
| **Interpretar** | Foxy Content Intelligence: contenido, rendimiento, estrategia, creatividad, reputación   | Motor local por reglas; IA generativa preparada para GO (doc 25)                                                                   |
| **Recomendar**  | Hallazgos con evidencia, separando hechos, interpretaciones, hipótesis y recomendaciones | Activo (local): Intelligence Home, Foxy Intelligence por pestañas, Ask Foxy lateral                                                |
| **Accionar**    | Brief, cronopost, pruebas A/B, MediaFOX OS, WhatsApp                                     | Próximas capacidades (visibles, no simuladas)                                                                                      |
| **Aprender**    | Memoria estratégica: aprendizajes, decisiones, resultados de pruebas                     | Foxy propone; owner/admin aprueba, rechaza con motivo o archiva, con historial                                                     |

## Principios

1. **Nunca inventar.** Ni datos, ni métricas, ni pilares, ni campañas. Sin evidencia, Foxy lo dice.
2. **Estrategia antes que estadística.** Toda interpretación se conecta, cuando existe, con el contexto autorizado de Brand Brain.
3. **Validación humana.** Foxy propone; las personas deciden. La estrategia de una marca nunca cambia automáticamente.
4. **Privacidad y aislamiento.** Datos de cada organización aislados (RLS); IA solo en servidor; ningún dato real sale a un proveedor externo sin GO específico.
5. **Un solo lenguaje visual.** Los mismos componentes del Design System V2 presentan indicadores y hallazgos en todos los módulos.

## Módulos (presentes y futuros)

Intelligence Home · Social Explorer · Ask Foxy · Foxy Brand Brain · Conversation Studio · Campaign Intelligence · Reputation War Room · Insights & Reports · Competitive Intelligence.

## Brand Knowledge Library (decisión de producto, 2026-11-27)

Foxy Brand Brain evoluciona hacia una **incorporación inteligente del conocimiento estratégico**. Nombre de trabajo: **Brand Knowledge Library**. Documentado, **no implementado**.

| Capacidad                 | Alcance                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Biblioteca documental     | Por organización, aislada por RLS; PDF, PPTX, DOCX y otros formatos autorizados; cada documento con versión, fecha, autor y origen         |
| Extracción inteligente    | Foxy propone objetivos, pilares, campañas, audiencias, lineamientos creativos, tono y restricciones                                        |
| Trazabilidad              | Cada propuesta cita documento, versión y página (o diapositiva/sección); sin referencia no hay propuesta                                   |
| Validación humana         | Foxy propone; owner/admin revisa, aprueba, corrige o rechaza con motivo (mismo flujo que la memoria, 0008)                                 |
| Conocimiento estructurado | El formulario actual de Brand Brain se conserva como **editor del conocimiento estructurado**: lo aprobado se incorpora como nueva versión |
| Memoria estratégica       | Aprendizajes y decisiones enlazados a los documentos que los sustentan                                                                     |

Principios: nunca inventar estrategia; ningún documento real se procesa sin GO de la marca; el documento original no se envía a un proveedor externo sin el GO de datos reales (doc 25); extracción y aprobación quedan registradas. Notas técnicas previas: la API de Claude lee PDF de forma nativa; PPTX y DOCX requieren extracción de texto en el servidor (evaluar sin añadir dependencias al lockfile compartido); el almacenamiento de documentos necesita Storage privado por organización con su propio GO.

## Roadmap de Foxy (orden propuesto, cada paso con GO)

1. ~~Aplicar 0007 y 0008 en `heyfoxy-qa`~~ (hecho: Brand Brain, memoria y revisión humana persistentes).
2. **IA generativa en Foxy Intelligence Engine** (doc 25): adaptador REST → pruebas sintéticas con tope → datos reales de MedPlus solo texto → multimodal.
3. Cargar el contexto estratégico autorizado de MedPlus en el formulario de Brand Brain (lo escribe MediaFOX con fuentes; Foxy no lo inventa).
4. **Brand Knowledge Library**: biblioteca documental, extracción con referencias, validación humana, versionado (sección anterior).
5. Refinamientos registrados tras la revisión del Preview `1c70e0b` (TECH_BACKLOG: HF-UX-22 a 24, HF-AI-14 y 15, HF-MC-04).
6. Acciones: brief creativo, cronopost, pruebas A/B, recomendación ejecutiva, MediaFOX OS, WhatsApp.
7. Comentarios con un control de privacidad aprobado → Reputation Intelligence.
