'use client';

import Link from 'next/link';
import { MapPin, Plus } from 'lucide-react';
import * as React from 'react';
import type { ApiSite } from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/movos/empty-state';
import { ApiSiteStatusBadge } from '@/components/movos/api-site-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/context/auth-context';
import { CreateSiteModal } from './_create-site-modal';

type LoadState = 'loading' | 'ready' | 'error';

export default function SitesPage() {
  const { membership } = useAuth();
  const [sites, setSites] = React.useState<ApiSite[]>([]);
  const [state, setState] = React.useState<LoadState>('loading');
  const [modalOpen, setModalOpen] = React.useState(false);

  const canCreate =
    membership?.role === 'OWNER' || membership?.role === 'ADMIN';

  const load = React.useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const data = await apiClient.get<ApiSite[]>('/sites');
      setSites(data);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleCreated(site: ApiSite): void {
    setSites((prev) => [site, ...prev]);
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestructura"
        title="Sitios"
        description="Ubicaciones físicas de la red de carga y su estado operativo."
        actions={
          canCreate ? (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Crear sitio
            </Button>
          ) : undefined
        }
      />

      <section className="mt-8">
        {state === 'loading' && <SitesSkeleton />}

        {state === 'error' && (
          <EmptyState
            icon={MapPin}
            title="No fue posible cargar los sitios."
            description="Verifica tu conexión con MOVOS e intenta nuevamente."
            action={
              <Button variant="outline" onClick={() => void load()}>
                Reintentar
              </Button>
            }
          />
        )}

        {state === 'ready' && sites.length === 0 && (
          <EmptyState
            icon={MapPin}
            title="No hay sitios registrados. Crea el primero."
            action={
              canCreate ? (
                <Button onClick={() => setModalOpen(true)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Crear sitio
                </Button>
              ) : undefined
            }
          />
        )}

        {state === 'ready' && sites.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {sites.map((site) => (
              <Link key={site.id} href={`/sites/${site.id}`}>
                <Card className="hover:border-movos-blue/50 h-full transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{site.name}</CardTitle>
                        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                          <MapPin className="size-3" aria-hidden="true" />
                          {site.city} · {site.address}
                        </p>
                      </div>
                      <ApiSiteStatusBadge status={site.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-xs">
                    {site.latitude !== null && site.longitude !== null
                      ? `${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}`
                      : 'Sin coordenadas'}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CreateSiteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </PageContainer>
  );
}

function SitesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((key) => (
        <Card key={key} className="h-32 animate-pulse">
          <CardContent className="pt-6">
            <div className="bg-muted h-4 w-1/2 rounded" />
            <div className="bg-muted mt-3 h-3 w-3/4 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
