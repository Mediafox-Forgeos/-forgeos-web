'use client';

import * as React from 'react';
import { AlertCircle, MapPin, Search, X } from 'lucide-react';
import { APIProvider, AdvancedMarker, Map } from '@vis.gl/react-google-maps';
import type {
  LocationSource,
  LocationSuggestion,
  ResolvedLocation,
} from '@mediafox/shared-types';

import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY ?? '';
const COLOMBIA_CENTER = { lat: 4.5709, lng: -74.2973 };
const DEFAULT_ZOOM = 5;
const SELECTED_ZOOM = 15;

export interface LocationValue {
  address: string;
  formattedAddress?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  locationSource: LocationSource;
}

interface LocationPickerProps {
  value?: LocationValue;
  onChange: (value: LocationValue) => void;
  disabled?: boolean;
  error?: string;
}

function generateSessionToken(): string {
  return crypto.randomUUID();
}

export function LocationPicker({
  value,
  onChange,
  disabled,
  error,
}: LocationPickerProps) {
  const [query, setQuery] = React.useState(
    value?.formattedAddress ?? value?.address ?? '',
  );
  const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>(
    [],
  );
  const [isFetchingSuggestions, setIsFetchingSuggestions] =
    React.useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = React.useState(false);
  const [sessionToken, setSessionToken] = React.useState(generateSessionToken);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [mapError, setMapError] = React.useState<string | null>(null);
  const [markerPos, setMarkerPos] = React.useState<{
    lat: number;
    lng: number;
  } | null>(
    value?.latitude != null && value?.longitude != null
      ? { lat: value.latitude, lng: value.longitude }
      : null,
  );
  const [mapZoom, setMapZoom] = React.useState(
    value?.latitude != null ? SELECTED_ZOOM : DEFAULT_ZOOM,
  );
  const [showManual, setShowManual] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const hasLocation = value?.latitude != null && value?.longitude != null;
  const hasBrowserKey = BROWSER_KEY.length > 0;

  React.useEffect(() => {
    if (value?.latitude != null && value?.longitude != null) {
      setMarkerPos({ lat: value.latitude, lng: value.longitude });
      setMapZoom(SELECTED_ZOOM);
    }
  }, [value?.latitude, value?.longitude]);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value;
    setQuery(input);
    clearTimeout(debounceRef.current);
    if (input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(input);
    }, 300);
  }

  async function fetchSuggestions(input: string) {
    setIsFetchingSuggestions(true);
    try {
      const results = await apiClient.get<LocationSuggestion[]>(
        `/locations/autocomplete?input=${encodeURIComponent(input)}&sessionToken=${sessionToken}`,
        { skipOrgHeader: true },
      );
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }

  async function handleSelectSuggestion(s: LocationSuggestion) {
    setShowSuggestions(false);
    setQuery(s.description);
    setIsResolvingPlace(true);
    try {
      const resolved = await apiClient.get<ResolvedLocation>(
        `/locations/place/${encodeURIComponent(s.placeId)}?sessionToken=${sessionToken}`,
        { skipOrgHeader: true },
      );
      setSessionToken(generateSessionToken());
      if (resolved) {
        onChange({
          address: resolved.formattedAddress,
          formattedAddress: resolved.formattedAddress,
          addressLine1: resolved.components.addressLine1,
          addressLine2: resolved.components.addressLine2,
          city: resolved.components.city,
          state: resolved.components.state,
          postalCode: resolved.components.postalCode,
          countryCode: resolved.components.countryCode,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          googlePlaceId: resolved.placeId,
          locationSource: 'GOOGLE_PLACES',
        });
      }
    } catch {
      setMapError(
        'No fue posible obtener los detalles del lugar. Intenta nuevamente.',
      );
    } finally {
      setIsResolvingPlace(false);
    }
  }

  function handleMarkerDrag(lat: number, lng: number) {
    setMarkerPos({ lat, lng });
    const base: LocationValue = value ?? {
      address: query,
      locationSource: 'MANUAL',
    };
    onChange({
      ...base,
      latitude: lat,
      longitude: lng,
      locationSource: 'MANUAL_ADJUSTMENT',
    });
  }

  function handleClear() {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setMarkerPos(null);
    setMapZoom(DEFAULT_ZOOM);
    setMapError(null);
    setSessionToken(generateSessionToken());
    onChange({ address: '', locationSource: 'MANUAL' });
  }

  function handleManualCoord(field: 'latitude' | 'longitude', raw: string) {
    const num = parseFloat(raw);
    if (Number.isNaN(num)) return;
    const base: LocationValue = value ?? {
      address: query,
      locationSource: 'MANUAL',
    };
    const next: LocationValue = {
      ...base,
      [field]: num,
      locationSource: 'MANUAL' as LocationSource,
    };
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {/* Address search */}
      <div className="relative z-10">
        <label className="mb-1.5 block text-sm font-medium">Dirección</label>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={handleQueryChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Buscar una dirección"
            disabled={disabled || isResolvingPlace}
            className="pl-9 pr-8"
            aria-label="Buscar una dirección"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            autoComplete="off"
          />
          {(query || hasLocation) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 rounded"
              aria-label="Limpiar ubicación"
            >
              <X className="size-4" />
            </button>
          )}

          {/* Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="border-border bg-popover text-popover-foreground absolute z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-xl"
            >
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="hover:bg-accent hover:text-accent-foreground flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors"
                    onMouseDown={() => void handleSelectSuggestion(s)}
                  >
                    <MapPin
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    <span>
                      <span className="font-medium">{s.mainText}</span>
                      {s.secondaryText && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          {s.secondaryText}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
              <li className="border-border border-t px-3 py-1.5">
                <p className="text-muted-foreground text-xs">
                  con tecnología de Google
                </p>
              </li>
            </ul>
          )}

          {showSuggestions &&
            suggestions.length === 0 &&
            !isFetchingSuggestions &&
            query.length >= 3 && (
              <div className="border-border bg-popover absolute z-50 mt-1 w-full rounded-lg border p-3 text-sm shadow-lg">
                <p className="text-muted-foreground">
                  No encontramos coincidencias
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Map + details — hidden while suggestions are open, fade in on selection */}
      <div
        aria-hidden={showSuggestions}
        className={`space-y-3 transition-opacity duration-300 ease-in-out ${
          showSuggestions ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        {/* Confirmed address pill */}
        {hasLocation && value?.formattedAddress && (
          <div className="bg-muted/50 flex items-start gap-2 rounded-lg p-3">
            <MapPin
              className="text-movos-blue mt-0.5 size-4 shrink-0"
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium">Ubicación confirmada</p>
              <p className="text-muted-foreground text-xs">
                {value.formattedAddress}
              </p>
            </div>
          </div>
        )}

        {/* Map */}
        {hasBrowserKey ? (
          <div
            className="overflow-hidden rounded-xl border"
            style={{ height: 260 }}
          >
            <APIProvider
              apiKey={BROWSER_KEY}
              onError={() =>
                setMapError(
                  'El mapa no está disponible. Puedes ingresar las coordenadas manualmente.',
                )
              }
            >
              <Map
                defaultCenter={markerPos ?? COLOMBIA_CENTER}
                center={markerPos ?? undefined}
                zoom={mapZoom}
                mapId="movos-location-picker"
                gestureHandling="greedy"
                disableDefaultUI
                className="h-full w-full"
              >
                {markerPos && (
                  <AdvancedMarker
                    position={markerPos}
                    draggable={!disabled}
                    onDragEnd={(e) => {
                      if (e.latLng) {
                        handleMarkerDrag(e.latLng.lat(), e.latLng.lng());
                      }
                    }}
                    title="Ajusta el marcador si el punto operativo es diferente"
                  />
                )}
              </Map>
            </APIProvider>
          </div>
        ) : (
          <div className="bg-muted flex h-[260px] items-center justify-center rounded-xl border">
            <p className="text-muted-foreground text-sm">
              Vista de mapa no disponible
            </p>
          </div>
        )}

        {markerPos && (
          <p className="text-muted-foreground text-xs">
            Ajusta el marcador si el punto operativo es diferente a la dirección
            postal
          </p>
        )}

        {/* Manual coordinates toggle */}
        <div>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground h-auto p-0 text-xs underline-offset-2 hover:underline"
            onClick={() => setShowManual((s) => !s)}
          >
            {showManual
              ? 'Ocultar coordenadas'
              : 'Ingresar coordenadas manualmente'}
          </Button>
        </div>

        {(showManual || hasLocation) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Latitud</label>
              <Input
                type="number"
                step="any"
                min={-90}
                max={90}
                value={value?.latitude ?? ''}
                onChange={(e) => handleManualCoord('latitude', e.target.value)}
                disabled={disabled}
                placeholder="−90 a 90"
                aria-label="Latitud"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Longitud</label>
              <Input
                type="number"
                step="any"
                min={-180}
                max={180}
                value={value?.longitude ?? ''}
                onChange={(e) => handleManualCoord('longitude', e.target.value)}
                disabled={disabled}
                placeholder="−180 a 180"
                aria-label="Longitud"
              />
            </div>
          </div>
        )}
      </div>

      {/* Errors — always visible */}
      {(mapError ?? error) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-amber-500"
            aria-hidden
          />
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {mapError ?? error}
          </p>
        </div>
      )}
    </div>
  );
}
