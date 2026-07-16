# MOVOS Location Capability

## Overview

MOVOS Sites can be optionally enriched with validated address data and GPS coordinates via the Google Maps Platform. Users type a free-text address, receive real-time autocomplete suggestions from Google Places, and select one to auto-fill normalized address components, coordinates, and a place ID. A draggable map marker lets operators adjust the precise charging-point location without changing the postal address.

The feature degrades gracefully: if no Google API keys are configured, the UI falls back to a plain text input and a "map unavailable" placeholder.

---

## API Key Separation

| Key | Environment variable | Restriction | Used by |
|-----|---------------------|-------------|---------|
| Server key | `MOVOS_GOOGLE_MAPS_SERVER_API_KEY` | Server IP / Railway service | NestJS `GoogleMapsAdapter` — autocomplete + place details |
| Browser key | `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY` | HTTP Referrer (your Vercel domain) | Next.js `@vis.gl/react-google-maps` — map render only |

The server key is never sent to the browser. The browser key is only used to render the map tile — it cannot call Places or Geocoding APIs without the server key.

---

## Data Model

New fields on `Site` (all optional):

| Field | Type | Description |
|-------|------|-------------|
| `formattedAddress` | `String?` | Google-formatted full address |
| `addressLine1` | `String?` | Street + number |
| `addressLine2` | `String?` | Suite, building, floor |
| `state` | `String?` | Department / state (administrative_area_level_1) |
| `postalCode` | `String?` | Postal code |
| `countryCode` | `String?` | ISO 3166-1 alpha-2 |
| `googlePlaceId` | `String?` | Canonical Google Place ID |
| `locationSource` | `LocationSource` | Enum: how coords were obtained |
| `locationValidationStatus` | `LocationValidationStatus` | Enum: confidence level |
| `locationValidatedAt` | `DateTime?` | Timestamp of last validation |

### LocationSource enum

- `GOOGLE_PLACES` — user selected from autocomplete
- `GOOGLE_GEOCODING` — reverse-geocoded (not yet implemented)
- `MANUAL` — operator typed coordinates directly
- `MANUAL_ADJUSTMENT` — dragged the map marker after Google-assisted fill

### LocationValidationStatus enum

- `UNVALIDATED` — default, no Google interaction
- `SUGGESTED` — suggestion presented but not confirmed
- `CONFIRMED` — place selected and resolved
- `PARTIAL` — some fields filled, others missing
- `INVALID` — validation attempted but failed

---

## Backend — Location Module

**Path:** `apps/movos-api/src/location/`

### Endpoints

Both endpoints require a valid JWT (`JwtAuthGuard`) and are rate-limited to 30 requests per 60 seconds per client.

#### `GET /locations/autocomplete`

| Query param | Required | Constraints |
|-------------|----------|-------------|
| `input` | yes | 3–200 chars |
| `sessionToken` | no | max 128 chars (UUID for billing grouping) |
| `region` | no | 2-char ISO country code, default `CO` |
| `language` | no | BCP-47 language tag, default `es` |

Returns `LocationSuggestion[]`:
```json
[
  {
    "placeId": "ChIJ...",
    "description": "Carrera 7 # 32-16, Bogotá, Colombia",
    "mainText": "Carrera 7 # 32-16",
    "secondaryText": "Bogotá, Colombia"
  }
]
```

#### `GET /locations/place/:placeId`

| Query param | Required |
|-------------|----------|
| `sessionToken` | no |
| `language` | no |

Returns `ResolvedLocation`:
```json
{
  "placeId": "ChIJ...",
  "formattedAddress": "Carrera 7 # 32-16, La Candelaria, Bogotá, Colombia",
  "components": {
    "addressLine1": "Carrera 7 # 32-16",
    "city": "Bogotá",
    "state": "Bogotá",
    "postalCode": "110311",
    "countryCode": "CO"
  },
  "latitude": 4.6097,
  "longitude": -74.0817,
  "source": "GOOGLE_PLACES"
}
```

The API **never** proxies raw Google responses. All responses are mapped to MOVOS contracts so the frontend is decoupled from Google's schema.

---

## Frontend — LocationPicker Component

**Path:** `apps/movos-web/src/components/location/location-picker.tsx`

### Props

```typescript
interface LocationPickerProps {
  value?: LocationValue;
  onChange: (value: LocationValue) => void;
  disabled?: boolean;
  error?: string;
}
```

### LocationValue shape

```typescript
interface LocationValue {
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
```

### Session token rotation

A UUID session token is generated on mount and rotated after each place selection. Google charges autocomplete and place-details calls in the same session as a single billing event; rotating on selection ensures the next search starts a fresh session.

---

## Frontend — SiteMap Component

**Path:** `apps/movos-web/src/components/location/site-map.tsx`

Read-only map for the site detail page. Accepts `lat`, `lng`, and an optional `height`. Falls back to a "Vista de mapa no disponible" placeholder when `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY` is not set.

---

## Graceful Degradation

| Condition | Behavior |
|-----------|----------|
| `MOVOS_GOOGLE_MAPS_SERVER_API_KEY` absent | `/locations/*` endpoints return empty array / null, no error |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY` absent | Map tiles replaced with text placeholder; address search still works via server |
| Google API returns an error | Adapter catches and logs; returns empty/null to client |
| User types < 3 characters | No API call made |
| User drags marker | `locationSource` set to `MANUAL_ADJUSTMENT`; postal address unchanged |
