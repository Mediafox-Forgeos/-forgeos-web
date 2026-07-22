# ADR-0007 — Google Maps Location Capability for MOVOS Sites

**Date:** 2026-07-16  
**Status:** Accepted  
**Deciders:** MediaFOX Forge / VULCAN

---

## Context

MOVOS Sites represent physical EV charging locations. The original data model stored a free-text `city` and `address` string plus optional `latitude`/`longitude` floats entered manually by the operator. This led to:

- Inconsistent address formats (different operators wrote the same street five different ways).
- Missing or inaccurate coordinates (operators had to use external tools to find lat/lng).
- No linkage between the MOVOS address record and a canonical geo-entity.

The goal is to let operators type a partial address, receive validated suggestions, and auto-fill all normalized components and coordinates — reducing data-entry errors and establishing a canonical `googlePlaceId` for future integrations (routing, isochrones, EV network maps).

---

## Decision

Integrate the **Google Maps Platform** using a server-side/browser-side key separation pattern:

1. **Server-side (Places API)** — `@googlemaps/google-maps-services-js` is added to `apps/movos-api`. A new `LocationModule` exposes two rate-limited, JWT-guarded endpoints:
   - `GET /locations/autocomplete` — proxies Places Autocomplete, returns MOVOS `LocationSuggestion[]`
   - `GET /locations/place/:placeId` — proxies Place Details, returns MOVOS `ResolvedLocation`
   
   The server key (`MOVOS_GOOGLE_MAPS_SERVER_API_KEY`) is restricted to the Railway server IP and never sent to the browser.

2. **Browser-side (Maps JavaScript API)** — `@vis.gl/react-google-maps` renders the interactive map tile in `LocationPicker` and the read-only `SiteMap`. The browser key (`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`) is restricted to the Vercel domain and cannot call Places or Geocoding.

3. **MOVOS contract layer** — the API never proxies raw Google JSON. All responses are mapped to `LocationSuggestion`, `ResolvedLocation`, and `AddressComponents` types defined in `@mediafox/shared-types`. The frontend has zero coupling to Google's field names.

4. **Graceful degradation** — both keys are optional. When absent, the autocomplete endpoint returns `[]`, the adapter's `isConfigured` flag is `false`, and the UI shows plain text inputs / map placeholder.

5. **Session tokens** — each `LocationPicker` mount generates a UUID session token. After a place is selected the token rotates. Google bills an autocomplete session (multiple keystrokes + one place details call) as a single event, so grouping via session tokens reduces cost.

---

## Alternatives Considered

### A — Client-side autocomplete (Google Maps JS API only, no backend proxy)

Simpler: one key, no backend changes. Rejected because:
- The Places API key visible in the browser bundle can be abused for unauthorized API calls even with referrer restrictions.
- Cannot enforce rate limits or MOVOS access control on autocomplete calls.
- Raw Google responses would leak into the frontend, coupling it to Google's schema.

### B — Mapbox Places + Geocoding

Feature-parity. Rejected because:
- The team already uses Google Maps elsewhere in ForgeOS.
- Google Places data quality for Latin American addresses is better than Mapbox at the time of writing.
- Switching cost outweighs consistency benefit.

### C — Manual lat/lng only (status quo)

No external dependency. Rejected because:
- Operators consistently enter wrong coordinates; support overhead is high.
- Address format normalization is not feasible without a reference dataset.

---

## Consequences

**Positive**
- Normalized, canonical address data across all Sites.
- `googlePlaceId` enables future geo-feature integrations (distance matrix, EV routing).
- Rate limiting and JWT guard prevent abuse of the Google API via MOVOS endpoints.
- No new Google dependency on the client beyond map tile rendering.

**Negative / Trade-offs**
- Two new environment variables to manage per environment (`MOVOS_GOOGLE_MAPS_SERVER_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`).
- Google Places billing applies to autocomplete + place detail calls. Session-token grouping is in place to minimize cost.
- Autocomplete is restricted by country (`region`) and `language` only — it does not filter by Google place type, so business names and points of interest can appear alongside street addresses. See "Open questions" below.

---

## Security & privacy

- The server key is optional/empty by default in `env.validation` and is never sent to the client; `.env.example` files ship empty values only (see the comments there for the graceful-degradation behavior when it's absent).
- Both `LocationController` endpoints require a valid access JWT (`JwtAuthGuard`) and are per-route rate-limited (`@nestjs/throttler`) to bound abuse and Google billing exposure.
- The adapter never returns raw Google payloads — only the normalized `LocationSuggestion` / `ResolvedLocation` contracts from `@mediafox/shared-types` cross the API boundary.

## Open questions / Pending decisions

- **Place-type restriction:** an earlier draft of this capability restricted autocomplete to `PlaceAutocompleteType.address` (addresses only, no businesses/POIs). The version that shipped does not apply this restriction — the trade-off between cleaner address-only suggestions and discoverability of business-named charging sites was not resolved before merge. This ADR previously stated the restriction was active; it is not, as of the current implementation. Whether to (re)introduce a type restriction is an open product decision, not yet made.

---

## Implementation

| Layer | File |
|-------|------|
| Prisma schema | `apps/movos-api/prisma/schema.prisma` — new enums + 11 fields on `Site` |
| Adapter | `apps/movos-api/src/location/google-maps.adapter.ts` |
| Service | `apps/movos-api/src/location/location.service.ts` |
| Controller | `apps/movos-api/src/location/location.controller.ts` |
| DTOs | `apps/movos-api/src/location/dto/` |
| Shared types | `packages/shared-types/src/movos-api.ts` |
| LocationPicker | `apps/movos-web/src/components/location/location-picker.tsx` |
| SiteMap | `apps/movos-web/src/components/location/site-map.tsx` |
| CreateSiteModal | `apps/movos-web/app/(app)/sites/_create-site-modal.tsx` |
| Site detail page | `apps/movos-web/app/(app)/sites/[siteId]/page.tsx` |
