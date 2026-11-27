-- Rollback de Hey Foxy 0009 → estado exacto de 0008. Borra el registro ampliado de consumo
-- (columnas nuevas) y las reservas; las filas de ai_usage se conservan con sus columnas de 0003.
drop function if exists public.hf_ai_note(uuid, uuid, text, text, text, text, boolean, boolean, integer);
drop function if exists public.hf_ai_release(uuid);
drop function if exists public.hf_ai_settle(uuid, text, text, integer, integer, integer, integer, numeric, integer, text);
drop function if exists public.hf_ai_reserve(uuid, uuid, text, text, text, numeric, boolean, numeric, numeric, integer, integer);
drop table if exists public.ai_reservations;
drop index if exists public.ai_usage_request_uidx;
alter table public.ai_usage drop constraint if exists ai_usage_tokens_check;
alter table public.ai_usage drop constraint if exists ai_usage_status_check;
alter table public.ai_usage drop column if exists request_id;
alter table public.ai_usage drop column if exists input_is_synthetic;
alter table public.ai_usage drop column if exists prompt_version;
alter table public.ai_usage drop column if exists brand_version;
alter table public.ai_usage drop column if exists cache_write_tokens;
alter table public.ai_usage drop column if exists cache_read_tokens;
alter table public.ai_usage drop column if exists status;
alter table public.ai_usage drop column if exists user_id;
