-- Rollback de qa_synthetic_go_ia_3.sql: retira SOLO lo que cargó ese seed y devuelve el Brand Brain
-- de Aurora al contenido ficticio «[PRUEBA QA]» anterior (la versión sigue subiendo: es una edición
-- más). Banco Horizonte vuelve a no tener Brand Brain. GENERADO por build-seed.py.
begin;
delete from public.social_posts
  where organization_id in ('9a000000-0000-4000-a000-0000000000a1', '9b000000-0000-4000-a000-0000000000b1') and external_id like 'goia3-%';
delete from public.brand_memory
  where organization_id in ('9a000000-0000-4000-a000-0000000000a1', '9b000000-0000-4000-a000-0000000000b1') and title in ('[SINTÉTICO] Los carruseles educativos concentran los guardados', '[SINTÉTICO] No usar imágenes de pacientes', '[SINTÉTICO] Las alertas de seguridad se comparten más', '[SINTÉTICO] Cifras simples y un paso práctico');
update public.brand_contexts set identity = '{"name": "[PRUEBA QA] Clínica Aurora (ficticia)", "tone": "[PRUEBA QA] Cercano y claro.", "industry": "", "description": "", "personality": "", "positioning": "", "brandManualRef": "", "valueProposition": "[PRUEBA QA] Propuesta de valor ficticia para validar el versionado.", "visualGuidelines": ""}'::jsonb, strategy = '{"kpis": ["[PRUEBA QA] Alcance", "[PRUEBA QA] Guardados"], "organic": "", "pillars": [{"name": "[PRUEBA QA] Prevención", "keywords": ["prevención", "chequeo"], "description": "Hábitos y chequeos"}, {"name": "[PRUEBA QA] Experiencia", "keywords": ["cita", "atención"], "description": "Citas y atención"}], "audiences": ["[PRUEBA QA] Familias jóvenes"], "marketing": "", "competitors": [], "businessGoals": [], "communication": "", "consumerInsights": [], "communicationGoals": ["[PRUEBA QA] Aumentar alcance de piezas de prevención"]}'::jsonb,
  campaigns = '[{"name": "[PRUEBA QA] Campaña ficticia", "goals": "Alcance", "endsOn": "", "status": "active", "concept": "Pequeños hábitos", "results": "", "channels": [], "startsOn": "", "audiences": "", "learnings": "", "keyMessages": "Prevenir es cuidarte"}]'::jsonb
  where organization_id = '9a000000-0000-4000-a000-0000000000a1';
delete from public.brand_contexts where organization_id = '9b000000-0000-4000-a000-0000000000b1';
commit;
