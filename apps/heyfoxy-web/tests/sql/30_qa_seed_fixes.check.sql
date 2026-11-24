-- Comprobaciones del seed QA tras qa_fix_001 + qa_fix_002 (+ refresh). Cada fila: nombre | valor | ok
with a as (select '9a000000-0000-4000-a000-0000000000a1'::uuid org),
c as (select c.* from public.social_comments c, a where c.organization_id = a.org and c.is_synthetic and c.external_id like 'qa-c-%'),
w as (
  select count(*) filter (where published_at > now() - interval '7 days')  d7,
         count(*) filter (where published_at > now() - interval '14 days') d14,
         count(*) filter (where published_at > now() - interval '30 days') d30,
         count(*) filter (where published_at <= now() - interval '7 days' and published_at > now() - interval '14 days') prev7,
         count(*) filter (where published_at <= now() - interval '14 days' and published_at > now() - interval '28 days') prev14,
         max(published_at) newest
  from c)
select 'periodos 7<14<30 distintos', format('%s/%s/%s', d7, d14, d30), (d7 < d14 and d14 < d30 and d30 = (select count(*) from c))::text from w
union all select 'periodo anterior de 7 días con datos', prev7::text, (prev7 > 0)::text from w
union all select 'periodo anterior de 14 días con datos', prev14::text, (prev14 > 0)::text from w
union all select 'lo más reciente ~1 h', newest::text, (newest between now() - interval '2 hours' and now())::text from w
union all select 'comentarios en la red de su publicación', count(*)::text, (count(*) = 0)::text
  from public.social_comments x join public.social_posts p on p.id = x.post_id where x.is_synthetic and x.platform <> p.platform
union all select 'comentarios después de su publicación', count(*)::text, (count(*) = 0)::text
  from public.social_comments x join public.social_posts p on p.id = x.post_id where x.is_synthetic and x.published_at < p.published_at
union all select 'sin fechas futuras', count(*)::text, (count(*) = 0)::text
  from (select published_at t from public.social_comments union all select captured_at from public.post_metric_snapshots
        union all select published_at from public.social_posts union all select created_at from public.alerts) f where t > now();
