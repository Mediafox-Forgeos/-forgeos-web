-- Rollback de 0008: vuelve exactamente a 0007. Las entradas rechazadas pasan a «archived»
-- (0007 no conoce «rejected»); los motivos de revisión se pierden: exportarlos antes si existen.
update public.brand_memory set status = 'archived' where status = 'rejected';
update public.brand_memory set validated_at = null, validated_by = null
  where status = 'archived' and validated_at is not null;
alter table public.brand_memory drop constraint if exists brand_memory_check;
alter table public.brand_memory add constraint brand_memory_check
  check ((status = 'validated') = (validated_at is not null));
alter table public.brand_memory drop constraint if exists brand_memory_rejected_note_check;
alter table public.brand_memory drop constraint if exists brand_memory_review_note_check;
alter table public.brand_memory drop constraint if exists brand_memory_status_check;
alter table public.brand_memory add constraint brand_memory_status_check
  check (status in ('proposed', 'validated', 'archived'));
alter table public.brand_memory drop column if exists reviewed_at;
alter table public.brand_memory drop column if exists reviewed_by;
alter table public.brand_memory drop column if exists review_note;
create or replace function public.hf_guard_brand_memory_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source_post_id is not null and not exists (
    select 1 from public.social_posts p
    where p.id = new.source_post_id and p.organization_id = new.organization_id) then
    raise exception 'cross-tenant reference rejected' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  if new.status = 'validated' and (tg_op = 'INSERT' or old.status <> 'validated') then
    new.validated_by := coalesce(auth.uid(), new.validated_by);
    new.validated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.hf_guard_brand_memory_org() from public, anon, authenticated, service_role;
