-- Rollback de qa_fix_001: devuelve los 6 comentarios a la red que tenían en el seed de Gate B.
-- Solo con GO. Mismo alcance y guardas que qa_fix_001.
begin;
with r(org, ext, platform) as (
  values
    ('9a000000-0000-4000-a000-0000000000a1'::uuid, 'qa-c-a-02', 'facebook'::public.hf_platform),
    ('9a000000-0000-4000-a000-0000000000a1'::uuid, 'qa-c-a-03', 'instagram'::public.hf_platform),
    ('9a000000-0000-4000-a000-0000000000a1'::uuid, 'qa-c-a-05', 'facebook'::public.hf_platform),
    ('9a000000-0000-4000-a000-0000000000a1'::uuid, 'qa-c-a-10', 'instagram'::public.hf_platform),
    ('9a000000-0000-4000-a000-0000000000a1'::uuid, 'qa-c-a-11', 'instagram'::public.hf_platform),
    ('9b000000-0000-4000-a000-0000000000b1'::uuid, 'qa-c-b-04', 'facebook'::public.hf_platform)
)
update public.social_comments c set platform = r.platform
from r where c.organization_id = r.org and c.external_id = r.ext and c.is_synthetic;
commit;
