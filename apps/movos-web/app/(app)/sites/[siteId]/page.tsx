'use client';

import { useParams } from 'next/navigation';
import * as React from 'react';
import type { ApiSite } from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/movos/empty-state';
import { Tabs } from '@/components/movos/tabs';
import { ApiSiteStatusBadge } from '@/components/movos/api-site-status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient, ApiError } from '@/lib/api-client';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

export default function SiteDetailPage() {
  const params = useParams<{ siteId: string }>();
  const siteId = params.siteId;
  const [site, setSite] = React.useState<ApiSite | null>(null);
  const [state, setState] = React.useState<LoadState>('loading');

  React.useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setState('loading');
      try {
        const data = await apiClient.get<ApiSite>(`/sites/${siteId}`);
        if (!cancelled) {
          setSite(data);
          setState('ready');
        }
      } catch (err) {
        if (cancelled) return;
        setState(
          err instanceof ApiError && err.status === 404 ? 'notfound' : 'error',
        );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  if (state === 'loading') {
    return (
      <PageContainer>
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted mt-4 h-40 animate-pulse rounded" />
      </PageContainer>
    );
  }

  if (state === 'notfound') {
    return (
      <PageContainer>
        <EmptyState title="Sitio no encontrado." />
      </PageContainer>
    );
  }

  if (state === 'error' || !site) {
    return (
      <PageContainer>
        <EmptyState title="No fue posible cargar el sitio." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: 'Sitios', href: '/sites' },
          { label: site.name },
        ]}
        title={site.name}
        description={`${site.city} · ${site.address}`}
        actions={<ApiSiteStatusBadge status={site.status} />}
      />

      <div className="mt-8">
        <Tabs
          items={[
            {
              id: 'overview',
              label: 'Resumen',
              content: (
                <div className="grid gap-4 sm:grid-cols-3">
                  <DetailCard label="Estado" value={site.status} />
                  <DetailCard label="Ciudad" value={site.city} />
                  <DetailCard
                    label="Coordenadas"
                    value={
                      site.latitude !== null && site.longitude !== null
                        ? `${site.latitude}, ${site.longitude}`
                        : 'Sin coordenadas'
                    }
                  />
                </div>
              ),
            },
            {
              id: 'infra',
              label: 'Infraestructura',
              content: (
                <EmptyState title="No hay estaciones registradas en este sitio." />
              ),
            },
          ]}
        />
      </div>
    </PageContainer>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-2 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
