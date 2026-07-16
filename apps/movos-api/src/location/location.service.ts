import { Injectable } from '@nestjs/common';
import type {
  LocationSuggestion,
  ResolvedLocation,
} from '@mediafox/shared-types';
import { GoogleMapsAdapter } from './google-maps.adapter';

@Injectable()
export class LocationService {
  constructor(private readonly maps: GoogleMapsAdapter) {}

  async autocomplete(
    input: string,
    sessionToken: string,
    region?: string,
    language?: string,
  ): Promise<LocationSuggestion[]> {
    if (!input || input.trim().length < 3) return [];
    return this.maps.autocomplete(
      input.trim(),
      sessionToken,
      region ?? 'co',
      language ?? 'es',
    );
  }

  async resolvePlace(
    placeId: string,
    sessionToken: string,
    language?: string,
  ): Promise<ResolvedLocation | null> {
    return this.maps.getPlace(placeId, sessionToken, language ?? 'es');
  }

  get mapsConfigured(): boolean {
    return this.maps.isConfigured;
  }
}
