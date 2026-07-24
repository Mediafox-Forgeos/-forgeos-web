'use client';

import { APIProvider, AdvancedMarker, Map } from '@vis.gl/react-google-maps';

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY ?? '';

interface SiteMapProps {
  lat: number;
  lng: number;
  height?: number;
}

export function SiteMap({ lat, lng, height = 240 }: SiteMapProps) {
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

  return (
    <div className="overflow-hidden rounded-xl border" style={{ height }}>
      <APIProvider apiKey={BROWSER_KEY}>
        <Map
          defaultCenter={{ lat, lng }}
          defaultZoom={15}
          mapId="movos-site-map"
          gestureHandling="none"
          disableDefaultUI
          className="h-full w-full"
        >
          <AdvancedMarker position={{ lat, lng }} />
        </Map>
      </APIProvider>
    </div>
  );
}
