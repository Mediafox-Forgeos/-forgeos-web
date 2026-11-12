# Hey Foxy — 06 · Piloto, modelo SaaS y costos (Fase 6)

| Propiedad  | Valor                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Work order | WO-MFOX-HEYFOXY-001                                                                                                      |
| Estado     | Gate 1 — PROPUESTA. **Precios de terceros por confirmar con cuentas reales**; precios de venta son hipótesis comerciales |
| Criterio   | AC07                                                                                                                     |

## 1. Piloto MedPlus

| Paso           | Detalle                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autorización   | Acuerdo escrito con MedPlus: cuentas incluidas, alcance (solo lectura), quién ve los datos, retención (90 días en piloto), eliminación al terminar               |
| Fuentes        | Solo cuentas propias de MedPlus: Instagram y Facebook (Metricool o app Meta en modo desarrollo), YouTube (API key). TikTok/LinkedIn solo si llegan vía Metricool |
| Datos          | Publicaciones y comentarios disponibles desde la fecha de conexión + histórico que permita la fuente (objetivo 30–90 días)                                       |
| Alertas        | Reglas iniciales conservadoras; WhatsApp a 2–5 destinatarios con consentimiento (MediaFOX + MedPlus)                                                             |
| Resumen diario | 8:00 a. m. (hora Colombia), por WhatsApp y email                                                                                                                 |
| Validación     | Muestra de 300–500 comentarios etiquetada por MediaFOX/MedPlus → acuerdo IA/humano; revisión semanal de falsos positivos/negativos                               |
| Éxito          | ≥ 85 % de acuerdo en sentimiento; ≥ 90 % de _recall_ en negativos críticos; 0 alertas duplicadas; resumen diario entregado ≥ 95 % de los días                    |

## 2. Demostración Banco de Occidente (independiente de Metricool)

- **Sin acceso a cuentas privadas ni credenciales del banco.** Organización separada en Hey Foxy, marcada como demo.
- Datos públicos realmente disponibles por vía oficial:
  - Instagram Business Discovery: perfil, publicaciones, contadores de likes/comentarios/vistas → actividad y publicaciones inusuales. **Sin texto de comentarios.**
  - YouTube: comentarios públicos de videos públicos del canal → sentimiento real.
  - X (opcional, con costo por lectura): publicaciones públicas.
- Para sentimiento de comentarios de Instagram/Facebook/TikTok se usan **datos sintéticos etiquetados "DATOS DE DEMOSTRACIÓN"**, nunca presentados como reales.
- El guion de demo explica qué se activaría con acceso autorizado (conectando sus propias cuentas).

## 3. Modelo SaaS (hipótesis para validar)

| Dimensión                                | Starter                   | Professional         | Enterprise                           |
| ---------------------------------------- | ------------------------- | -------------------- | ------------------------------------ |
| Marcas                                   | 1                         | 3                    | 10+                                  |
| Redes conectadas                         | 3                         | 6                    | Todas las soportadas                 |
| Interacciones analizadas/mes             | 5.000                     | 25.000               | 100.000+                             |
| Usuarios                                 | 3                         | 10                   | Ilimitados                           |
| Destinatarios WhatsApp                   | 2                         | 10                   | A medida                             |
| Alertas                                  | Resumen diario + críticas | Todas + escalamiento | Todas + reglas avanzadas             |
| Reportes                                 | Diario                    | Diario + semanal     | + mensual ejecutivo, exportación     |
| Retención                                | 90 días                   | 365 días             | 730 días o contrato                  |
| Fuentes públicas (YouTube/X/licenciadas) | —                         | YouTube              | Todas (costo de terceros trasladado) |
| Precio indicativo (USD/mes)              | 149–199                   | 449–599              | desde 1.200                          |

Los excedentes (interacciones, destinatarios, lecturas X) se facturan por uso. Validar disposición a pagar con MedPlus y 2–3 prospectos antes de fijar precios.

## 4. Costo estimado por cliente (supuestos explícitos)

Cliente tipo "Professional": 3 marcas, 4 redes, **10.000 interacciones/mes**, 5 destinatarios WhatsApp.

| Rubro                       | Supuesto                                                                                                         | Estimado mensual (USD)                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| IA — clasificación          | ~400 tokens de entrada y ~80 de salida por elemento en lotes, modelo pequeño                                     | 2–10                                        |
| IA — resúmenes e incidentes | 3 resúmenes/día + ~30 informes de incidente, modelo medio                                                        | 3–15                                        |
| WhatsApp                    | ~5 destinatarios × (30 resúmenes + ~40 alertas) ≈ 350 plantillas de utilidad Colombia                            | ≈ 0,3–1                                     |
| Metricool                   | Plan Advanced compartido entre clientes de MediaFOX (15 marcas)                                                  | 4–5 por marca (prorrateo) o 0 si ya se paga |
| X (opcional)                | 10.000 lecturas                                                                                                  | ≈ 50                                        |
| Infraestructura prorrateada | Supabase Pro (organización + cómputo del proyecto) + Vercel Pro existente + correo; repartido entre ~10 clientes | 5–15                                        |
| **Total sin X**             |                                                                                                                  | **≈ 15–45**                                 |

Costos fijos de plataforma (no por cliente, a confirmar): proyecto Supabase adicional para QA y Production (plan Pro de la organización y cómputo por proyecto), dominio y número de WhatsApp. n8n Cloud (€20–50/mes) solo si se aprueba su uso.

Margen bruto estimado con Professional a USD 449: > 85 %. **El costo dominante no es la tecnología sino la operación humana** (revisión de casos críticos, onboarding, soporte); cotizar servicios gestionados aparte.

## 5. Fuentes de precios

Ver [02_SOURCE_MATRIX.md §4](./02_SOURCE_MATRIX.md#4-fuentes-consultadas). WhatsApp: [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), [SleekFlow pricing](https://help.sleekflow.io/en_US/pricing). n8n: [n8n pricing 2026 (Sliplane)](https://sliplane.io/blog/n8n-pricing). Tarifas de modelos IA: listas de precios oficiales del proveedor elegido al momento de Gate 2.
