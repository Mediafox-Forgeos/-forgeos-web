import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  Language,
} from '@googlemaps/google-maps-services-js';
// Language enum is used for the placeDetails language param
import type {
  AddressComponent,
  AddressType,
  GeocodingAddressComponentType,
  PlaceAutocompleteResponse,
  PlaceDetailsResponse,
} from '@googlemaps/google-maps-services-js';
import type {
  LocationSuggestion,
  ResolvedLocation,
  AddressComponents,
} from '@mediafox/shared-types';

@Injectable()
export class GoogleMapsAdapter {
  private readonly client = new Client({});
  private readonly logger = new Logger(GoogleMapsAdapter.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('MOVOS_GOOGLE_MAPS_SERVER_API_KEY') ?? '';
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async autocomplete(
    input: string,
    sessionToken: string,
    region = 'co',
    language = 'es',
  ): Promise<LocationSuggestion[]> {
    if (!this.isConfigured) return [];
    try {
      const response: PlaceAutocompleteResponse =
        await this.client.placeAutocomplete({
          params: {
            input,
            key: this.apiKey,
            sessiontoken: sessionToken,
            components: [`country:${region}`],
            language,
          },
        });
      return (response.data.predictions ?? []).map((p) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text ?? p.description,
        secondaryText: p.structured_formatting?.secondary_text ?? '',
      }));
    } catch (err) {
      this.logger.warn('Google autocomplete failed', err);
      return [];
    }
  }

  async getPlace(
    placeId: string,
    sessionToken: string,
    language = 'es',
  ): Promise<ResolvedLocation | null> {
    if (!this.isConfigured) return null;
    try {
      const response: PlaceDetailsResponse = await this.client.placeDetails({
        params: {
          place_id: placeId,
          key: this.apiKey,
          sessiontoken: sessionToken,
          language: language as Language,
          fields: [
            'place_id',
            'formatted_address',
            'address_components',
            'geometry',
          ],
        },
      });
      const r = response.data.result;
      if (!r?.geometry?.location) return null;

      const components = this.parseComponents(r.address_components ?? []);
      return {
        placeId,
        formattedAddress: r.formatted_address ?? '',
        components,
        latitude: r.geometry.location.lat,
        longitude: r.geometry.location.lng,
        source: 'GOOGLE_PLACES',
      };
    } catch (err) {
      this.logger.warn('Google place details failed', err);
      return null;
    }
  }

  private parseComponents(
    components: AddressComponent[],
  ): AddressComponents {
    const get = (type: string): string | undefined =>
      components.find((c) =>
        c.types.includes(type as AddressType | GeocodingAddressComponentType),
      )?.long_name ?? undefined;
    const getShort = (type: string): string | undefined =>
      components.find((c) =>
        c.types.includes(type as AddressType | GeocodingAddressComponentType),
      )?.short_name ?? undefined;

    const streetNumber = get('street_number');
    const route = get('route');
    const addressLine1 =
      route
        ? streetNumber
          ? `${route} ${streetNumber}`
          : route
        : undefined;

    return {
      addressLine1,
      city:
        get('locality') ??
        get('administrative_area_level_2') ??
        get('administrative_area_level_1') ??
        '',
      state: get('administrative_area_level_1'),
      postalCode: get('postal_code'),
      countryCode: getShort('country'),
    };
  }
}
