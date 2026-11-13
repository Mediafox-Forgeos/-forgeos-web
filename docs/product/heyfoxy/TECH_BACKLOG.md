# Hey Foxy — TECH_BACKLOG

Deuda técnica y tareas de infraestructura abiertas. Prioridad: P0 bloquea el siguiente gate, P1 antes del piloto, P2 posterior.

| ID        | Prio | Tema                                                                                                                                                                  | Estado                                  |
| --------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| HF-INF-01 | P0   | Supabase QA de Hey Foxy en organización separada; requiere aprobación de costo (ver 09 §Supabase)                                                                     | Pendiente de decisión                   |
| HF-INF-02 | P0   | Validar `supabase-repository.ts` y las 3 migraciones contra Supabase real (QA): auth, RLS y grants por columna                                                        | Bloqueado por HF-INF-01                 |
| HF-OPS-01 | P0   | Script único de despliegue Preview: CLI ≥ 65; proyecto y equipo explícitos; prohibido `--prod`; verifica `target != production` y protección antes de publicar la URL | Por implementar (sin ejecutar)          |
| HF-OPS-02 | P1   | Riesgo: `.vercel/project.json` versionado en la raíz de ForgeOS apunta a `movos-web`. Evaluar con el dueño de MOVOS si debe seguir versionado                         | Reportado; no tocado                    |
| HF-OPS-03 | P1   | Destino del despliegue `dpl_CBLq2U37Axe66pHJakrqjCjyf8me` (Production accidental, protegido). Mantener o reemplazar en Gate 3                                         | Opción B temporal (decisión 2026-11-13) |
| HF-OPS-04 | P2   | Integración Git: no conectar hasta Gate 3. Al conectar, usar una Production Branch dedicada (no `main`) y un Ignored Build Step limitado a `apps/heyfoxy-web`         | Diferido                                |
| HF-OPS-05 | P2   | Alias estable de QA (p. ej. `heyfoxy-qa-mediafox.vercel.app`) apuntando al último Preview validado                                                                    | Diferido                                |
| HF-MC-01  | P1   | Conexión Metricool según 08 §3: requiere GO, autorización escrita de MedPlus y HF-INF-01. Credenciales no solicitadas ni almacenadas                                  | Bloqueado                               |
| HF-MC-02  | P1   | Ritmo y presupuesto de llamadas a Metricool: medir con `api-usage-stats` en la prueba acotada                                                                         | Bloqueado por HF-MC-01                  |
| HF-AI-01  | P1   | El clasificador heurístico comete errores (p. ej. «fue corta, bien» marcado negativo). Medir precisión con el proveedor externo antes del piloto                      | Abierto                                 |
| HF-WA-01  | P1   | WhatsApp Cloud API: portafolio Meta, número, plantillas y sandbox. Envíos reales bloqueados en código                                                                 | Bloqueado (requiere autorización)       |
| HF-SEC-01 | P1   | Revisión de seguridad del branch antes de la PR a `main`                                                                                                              | Pendiente                               |
