'use client';

import * as React from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
} from '@vis.gl/react-google-maps';

import type { ApiSiteHealthSummary } from '@mediafox/shared-types';

import {
  StationHealthBadge,
  stationHealthDotColor,
} from './station-health-badge';
import { usePolledResource } from './use-polled-resource';

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY ?? '';

/**
 * CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022) — Objective 1:
 * "extender el SiteMap existente." This is the fleet-wide extension of
 * `@/components/location/site-map.tsx`: many color-coded, clickable
 * markers instead of one static one. Reuses the same
 * `@vis.gl/react-google-maps` integration and browser API key — see
 * docs/implementation/CAPX_COMPONENT_MAP.md.
 */
export function FleetMap({ height = 420 }: { height?: number }) {
  const { data, error } = usePolledResource<ApiSiteHealthSummary[]>(
    '/operator/map',
    30_000,
  );
  const [selectedSiteId, setSelectedSiteId] = React.useState<string | null>(
    null,
  );

  const sitesWithLocation = React.useMemo(
    () =>
      (data ?? []).filter(
        (
          site,
        ): site is ApiSiteHealthSummary & {
          latitude: number;
          longitude: number;
        } => site.latitude !== null && site.longitude !== null,
      ),
    [data],
  );

  const center = React.useMemo(() => {
    if (sitesWithLocation.length === 0) return { lat: 4.6097, lng: -74.0817 };
    const lat =
      sitesWithLocation.reduce((sum, s) => sum + s.latitude, 0) /
      sitesWithLocation.length;
    const lng =
      sitesWithLocation.reduce((sum, s) => sum + s.longitude, 0) /
      sitesWithLocation.length;
    return { lat, lng };
  }, [sitesWithLocation]);

  if (!BROWSER_KEY) {
    return (
      <div
        className="bg-muted flex items-center justify-center rounded-xl border"
        style={{ height }}
      >
        <p className="text-muted-foreground text-sm">
          Vista de mapa no disponible
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-muted flex items-center justify-center rounded-xl border"
        style={{ height }}
      >
        <p className="text-muted-foreground text-sm">
          No se pudo cargar el mapa operacional.
        </p>
      </div>
    );
  }

  const selected = sitesWithLocation.find((s) => s.siteId === selectedSiteId);

  return (
    <div className="overflow-hidden rounded-xl border" style={{ height }}>
      <APIProvider apiKey={BROWSER_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={sitesWithLocation.length > 1 ? 6 : 13}
          mapId="movos-fleet-map"
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="h-full w-full"
        >
          {sitesWithLocation.map((site) => (
            <AdvancedMarker
              key={site.siteId}
              position={{ lat: site.latitude, lng: site.longitude }}
              onClick={() => setSelectedSiteId(site.siteId)}
            >
              <Pin
                background={stationHealthDotColor[site.worstStatus]}
                borderColor="#ffffff"
                glyphColor="#ffffff"
              />
            </AdvancedMarker>
          ))}

          {selected && (
            <InfoWindow
              position={{ lat: selected.latitude, lng: selected.longitude }}
              onCloseClick={() => setSelectedSiteId(null)}
            >
              <div className="min-w-[180px] space-y-1 p-1 text-sm text-slate-900">
                <p className="font-semibold">{selected.siteName}</p>
                <StationHealthBadge status={selected.worstStatus} />
                <p className="text-xs text-slate-600">
                  {selected.totalStations} estaciones activas ·{' '}
                  {selected.healthy} saludables · {selected.degraded} degradadas
                  · {selected.offline} fuera de línea
                </p>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
