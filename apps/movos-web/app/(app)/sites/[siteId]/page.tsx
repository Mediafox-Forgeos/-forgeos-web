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
import { SiteMap } from '@/components/location/site-map';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

const SOURCE_LABELS: Record<string, string> = {
  GOOGLE_PLACES: 'Google Places',
  GOOGLE_GEOCODING: 'Google Geocoding',
  MANUAL: 'Manual',
  MANUAL_ADJUSTMENT: 'Ajuste manual',
};

const VALIDATION_LABELS: Record<string, string> = {
  UNVALIDATED: 'Sin validar',
  SUGGESTED: 'Sugerida',
  CONFIRMED: 'Confirmada',
  PARTIAL: 'Parcial',
  INVALID: 'Inválida',
};

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

  const hasCoords = site.latitude != null && site.longitude != null;
  const displayAddress = site.formattedAddress ?? site.address;

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: 'Sitios', href: '/sites' },
          { label: site.name },
        ]}
        title={site.name}
        description={`${site.city} · ${displayAddress}`}
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
                      hasCoords
                        ? `${site.latitude}, ${site.longitude}`
                        : 'Sin coordenadas'
                    }
                  />
                </div>
              ),
            },
            {
              id: 'location',
              label: 'Ubicación',
              content: (
                <div className="space-y-6">
                  {hasCoords ? (
                    <SiteMap
                      lat={site.latitude as number}
                      lng={site.longitude as number}
                      height={280}
                    />
                  ) : (
                    <div className="bg-muted flex h-[200px] items-center justify-center rounded-xl border">
                      <p className="text-muted-foreground text-sm">
                        Sin coordenadas — edita el sitio para agregar una ubicación
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {site.formattedAddress && (
                      <LocationField
                        label="Dirección completa"
                        value={site.formattedAddress}
                        wide
                      />
                    )}
                    {site.addressLine1 && (
                      <LocationField label="Línea 1" value={site.addressLine1} />
                    )}
                    {site.addressLine2 && (
                      <LocationField label="Línea 2" value={site.addressLine2} />
                    )}
                    {site.city && (
                      <LocationField label="Ciudad" value={site.city} />
                    )}
                    {site.state && (
                      <LocationField label="Departamento / Estado" value={site.state} />
                    )}
                    {site.postalCode && (
                      <LocationField label="Código postal" value={site.postalCode} />
                    )}
                    {site.countryCode && (
                      <LocationField label="País" value={site.countryCode} />
                    )}
                    {hasCoords && (
                      <LocationField
                        label="Coordenadas"
                        value={`${site.latitude}, ${site.longitude}`}
                      />
                    )}
                    {site.locationSource && (
                      <LocationField
                        label="Fuente"
                        value={SOURCE_LABELS[site.locationSource] ?? site.locationSource}
                      />
                    )}
                    {site.locationValidationStatus && (
                      <LocationField
                        label="Validación"
                        value={
                          VALIDATION_LABELS[site.locationValidationStatus] ??
                          site.locationValidationStatus
                        }
                      />
                    )}
                  </div>

                  {!site.formattedAddress && !hasCoords && (
                    <p className="text-muted-foreground text-sm">
                      No hay información de ubicación registrada.
                    </p>
                  )}
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

function LocationField({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <p className="text-muted-foreground mb-0.5 text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
