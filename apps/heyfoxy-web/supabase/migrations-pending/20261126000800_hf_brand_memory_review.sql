-- Hey Foxy 0008 — Revisión humana de la memoria estratégica (WO-HF-V2-UX-REFINEMENT-002, fase F).
-- PREPARADA Y PROBADA SOLO EN LOCAL. No aplicar en heyfoxy-qa ni en Production sin GO.
--
--  * Nuevo estado «rejected» con motivo obligatorio (review_note).
--  * Trazabilidad de la revisión: reviewed_by / reviewed_at (quien aprueba, rechaza o archiva).
--  * Transiciones permitidas: proposed → validated | rejected | archived; validated → archived;
--    rejected → archived. Nada vuelve a «proposed» ni salta de validado a rechazado.
--  * El contenido propuesto (título, texto, evidencia, tipo, publicación, autor) es inmutable:
--    la revisión decide sobre lo que se propuso, no lo reescribe.
--  * Sin cambios de RLS: proponer sigue siendo owner/admin/analyst; revisar, owner/admin.
--  * Idempotente.

alter table public.brand_memory add column if not exists review_note text;
alter table public.brand_memory add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.brand_memory add column if not exists reviewed_at timestamptz;

alter table public.brand_memory drop constraint if exists brand_memory_status_check;
alter table public.brand_memory add constraint brand_memory_status_check
  check (status in ('proposed', 'validated', 'rejected', 'archived'));
-- Archivar una memoria validada conserva quién y cuándo la aprobó.
alter table public.brand_memory drop constraint if exists brand_memory_check;
alter table public.brand_memory add constraint brand_memory_check
  check ((status <> 'validated' or validated_at is not null)
         and (validated_at is null or status in ('validated', 'archived')));
alter table public.brand_memory drop constraint if exists brand_memory_review_note_check;
alter table public.brand_memory add constraint brand_memory_review_note_check
  check (review_note is null or length(trim(review_note)) between 3 and 500);
alter table public.brand_memory drop constraint if exists brand_memory_rejected_note_check;
alter table public.brand_memory add constraint brand_memory_rejected_note_check
  check (status <> 'rejected' or review_note is not null);

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
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    if (new.organization_id, new.kind, new.title, new.body, new.evidence, new.source_post_id,
        new.created_by, new.created_at, new.is_synthetic)
       is distinct from
       (old.organization_id, old.kind, old.title, old.body, old.evidence, old.source_post_id,
        old.created_by, old.created_at, old.is_synthetic) then
      raise exception 'proposed memory content is immutable' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      if not ((old.status = 'proposed' and new.status in ('validated', 'rejected', 'archived'))
              or (old.status in ('validated', 'rejected') and new.status = 'archived')) then
        raise exception 'invalid memory review transition % -> %', old.status, new.status
          using errcode = '42501';
      end if;
      new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
      new.reviewed_at := now();
    else
      -- Sin cambio de estado, la revisión registrada no se reescribe.
      new.review_note := old.review_note;
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
    end if;
  end if;
  if new.status = 'validated' and (tg_op = 'INSERT' or old.status <> 'validated') then
    new.validated_by := coalesce(auth.uid(), new.validated_by);
    new.validated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.hf_guard_brand_memory_org() from public, anon, authenticated, service_role;
