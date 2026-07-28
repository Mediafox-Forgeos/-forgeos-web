'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import * as React from 'react';
import type { ApiSite } from '@mediafox/shared-types';

import { EmptyState } from '@/components/movos/empty-state';
import { ApiSiteStatusBadge } from '@/components/movos/api-site-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Shared "pick a Site first" gateway for /chargers and /connectors. Neither
 * route has an org-wide list-all endpoint to call (ARGOS ruling,
 * WO-ARGOS-005) — charging infrastructure is reached by drilling down from
 * a Site, never listed flat. This fetches the same real /sites endpoint
 * the Sites list page uses, but renders a deliberately minimal picker (no
 * create action, no map, no filters) so it reads as a gateway, not a
 * second Sites screen.
 */
export function SiteSelectionList() {
  const [sites, setSites] = React.useState<ApiSite[]>([]);
  const [state, setState] = React.useState<LoadState>('loading');

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

  if (state === 'loading') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((key) => (
          <Card key={key} className="h-24 animate-pulse">
            <CardContent className="pt-6">
              <div className="bg-muted h-4 w-1/2 rounded" />
              <div className="bg-muted mt-3 h-3 w-3/4 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (state === 'error') {
    return (
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
    );
  }

  if (sites.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No hay sitios registrados todavía."
        description="Crea un sitio antes de administrar su infraestructura de carga."
        action={
          <Button asChild>
            <Link href="/sites">Ir a Sitios</Link>
          </Button>
        }
      />
    );
  }

  return (
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
                    {site.city}
                  </p>
                </div>
                <ApiSiteStatusBadge status={site.status} />
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
