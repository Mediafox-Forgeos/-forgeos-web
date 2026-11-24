-- Hey Foxy · QA · corrección de datos sintéticos 001 (WO-HF-V2-REFINEMENT-001, Fase A punto 9)
--
-- PREPARADO, NO EJECUTADO. Requiere GO explícito con este archivo y su md5 antes de aplicarse
-- en heyfoxy-qa (admbpgqtgmaaofcgajzh) por el MCP supabase-heyfoxy-qa. No es una migración:
-- no cambia esquema, RLS ni permisos; solo corrige 6 filas sintéticas del seed QA.
--
-- Defecto: 6 comentarios sintéticos están asociados a una publicación de otra red (p. ej.
-- comentarios de Facebook en una publicación de Instagram). Un comentario vive en la red de
-- su publicación, así que se alinea `platform` del comentario con el de su publicación.
-- `supabase/seed/qa_seed.sql` ya está corregido para cargas futuras.
--
-- Garantías: solo filas con is_synthetic = true, de las 2 organizaciones QA y con external_id
-- explícito; idempotente (una segunda ejecución actualiza 0 filas). Debe actualizar exactamente 6.

begin;

with fix(org, ext, platform) as (
  values
    ('9a000000-0000-4000-a000-0000000000a1'::uuid, 'qa-c-a-02', 'instagram'::public.hf_platform),
    ('9a000000-0000-4000-a000-0000000000a1'::uuid, 'qa-c-a-03', 'facebook'::public.hf_platform),
    ('9a000000-0000-4000-a000-0000000000a1'::uuid, 'qa-c-a-05', 'instagram'::public.hf_platform),
    ('9a000000-0000-4000-a000-0000000000a1'::uuid, 'qa-c-a-10', 'facebook'::public.hf_platform),
    ('9a000000-0000-4000-a000-0000000000a1'::uuid, 'qa-c-a-11', 'facebook'::public.hf_platform),
    ('9b000000-0000-4000-a000-0000000000b1'::uuid, 'qa-c-b-04', 'x'::public.hf_platform)
)
update public.social_comments c
set platform = f.platform
from fix f, public.social_posts p
where c.organization_id = f.org
  and c.external_id = f.ext
  and c.is_synthetic
  and p.id = c.post_id
  and p.organization_id = c.organization_id
  and p.platform = f.platform        -- solo si la publicación es de esa red
  and c.platform <> f.platform;      -- idempotente

-- Verificación: ningún comentario sintético en una red distinta de la de su publicación.
do $$
declare n int;
begin
  select count(*) into n
  from public.social_comments c
  join public.social_posts p on p.id = c.post_id and p.organization_id = c.organization_id
  where c.is_synthetic and c.platform <> p.platform;
  if n <> 0 then
    raise exception 'quedan % comentarios sintéticos en otra red', n;
  end if;
end $$;

commit;
