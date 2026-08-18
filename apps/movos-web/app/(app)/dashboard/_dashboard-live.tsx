'use client';

import { Building2, CheckCircle2, MapPin, XCircle } from 'lucide-react';
import * as React from 'react';
import type { ApiSite, HealthResponse } from '@mediafox/shared-types';

import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { tenant } from '@/config/tenant';
import { usePolledResource } from '@/components/operator/use-polled-resource';

const HEALTH_POLL_INTERVAL_MS = 30_000;

/**
 * Live dashboard strip backed by the MOVOS API: organization name,
 * persistent site count and API health.
 *
 * WO-ARGOS-057 — brought onto the same polling discipline as every other
 * Operations Console widget (this was previously the one dashboard card
 * that never refreshed without a full page reload). Site count reuses
 * usePolledResource like everything else; the health check keeps its own
 * raw `fetch` (it hits `/health`, outside apiClient's authenticated
 * `/api/v1` surface and doesn't need Authorization/X-Organization-Id
 * headers) but now polls on the same interval/cleanup shape rather than a
 * one-shot effect — no new fetching abstraction introduced.
 */
export function DashboardLive() {
  const { currentOrg } = useAuth();
  const { data: sites } = usePolledResource<ApiSite[]>(
    '/sites',
    HEALTH_POLL_INTERVAL_MS,
  );
  const siteCount = sites?.length ?? null;
  const [health, setHealth] = React.useState<'ok' | 'down' | 'unknown'>(
    'unknown',
  );

  React.useEffect(() => {
    let cancelled = false;

    async function loadHealth(): Promise<void> {
      const base =
        process.env.NEXT_PUBLIC_MOVOS_API_URL ?? 'http://localhost:4000';
      try {
        const res = await fetch(`${base}/api/v1/health`, {
          cache: 'no-store',
        });
        const data = (await res.json()) as HealthResponse;
        if (!cancelled) setHealth(data.status === 'ok' ? 'ok' : 'down');
      } catch {
        if (!cancelled) setHealth('down');
      }
    }

    void loadHealth();
    const timer = setInterval(() => void loadHealth(), HEALTH_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const orgName = currentOrg?.name ?? tenant.orgName;

  return (
    <section className="mt-8 grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="flex items-center gap-3 pt-5">
          <span className="bg-movos-blue/20 text-movos-blue grid size-10 place-items-center rounded-lg">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs">Organización</p>
            <p className="font-medium">{orgName}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 pt-5">
          <span className="bg-movos-blue/20 text-movos-blue grid size-10 place-items-center rounded-lg">
            <MapPin className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs">Sitios registrados</p>
            <p className="font-medium">
              {siteCount === null ? '—' : siteCount}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 pt-5">
          <span
            className={
              health === 'ok'
                ? 'grid size-10 place-items-center rounded-lg bg-emerald-500/20 text-emerald-400'
                : 'grid size-10 place-items-center rounded-lg bg-red-500/20 text-red-400'
            }
          >
            {health === 'ok' ? (
              <CheckCircle2 className="size-5" aria-hidden="true" />
            ) : (
              <XCircle className="size-5" aria-hidden="true" />
            )}
          </span>
          <div>
            <p className="text-muted-foreground text-xs">Estado del API</p>
            <p className="font-medium">
              {health === 'ok'
                ? 'Operativo'
                : health === 'down'
                  ? 'Sin conexión'
                  : 'Verificando…'}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
