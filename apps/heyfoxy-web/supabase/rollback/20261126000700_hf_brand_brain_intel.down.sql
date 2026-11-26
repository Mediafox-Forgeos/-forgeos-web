-- Rollback de 0007 (Brand Brain, memoria estratégica, caché de inteligencia, ai_kill_switch).
-- ATENCIÓN: borra el contexto estratégico y la memoria guardados. Exportarlos antes si existen.
drop table if exists public.content_intel_cache;
drop table if exists public.brand_memory;
drop table if exists public.brand_contexts;
drop function if exists public.hf_guard_brand_memory_org();
drop function if exists public.hf_brand_context_version();
delete from public.hf_runtime_flags where flag = 'ai_kill_switch';
alter table public.hf_runtime_flags drop constraint if exists hf_runtime_flags_flag_check;
alter table public.hf_runtime_flags add constraint hf_runtime_flags_flag_check
  check (flag in ('sync_kill_switch'));
