import { Test } from '@nestjs/testing';
import type { LocationSuggestion, ResolvedLocation } from '@mediafox/shared-types';
import { GoogleMapsAdapter } from './google-maps.adapter';
import { LocationService } from './location.service';

function makeAdapter(
  overrides: Partial<Record<keyof GoogleMapsAdapter, unknown>> = {},
): GoogleMapsAdapter {
  return {
    isConfigured: true,
    autocomplete: jest.fn().mockResolvedValue([]),
    getPlace: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as GoogleMapsAdapter;
}

async function build(
  overrides: Partial<Record<keyof GoogleMapsAdapter, unknown>> = {},
): Promise<{ service: LocationService; adapter: GoogleMapsAdapter }> {
  const adapter = makeAdapter(overrides);
  const module = await Test.createTestingModule({
    providers: [
      LocationService,
      { provide: GoogleMapsAdapter, useValue: adapter },
    ],
  }).compile();
  return { service: module.get(LocationService), adapter };
}

const SUGGESTION: LocationSuggestion = {
  placeId: 'p1',
  description: 'Cra 7 # 32-16, Bogotá, Colombia',
  mainText: 'Cra 7 # 32-16',
  secondaryText: 'Bogotá, Colombia',
};

const RESOLVED: ResolvedLocation = {
  placeId: 'p1',
  formattedAddress: 'Cra 7 # 32-16, Bogotá, Colombia',
  components: {
    addressLine1: 'Cra 7 # 32-16',
    city: 'Bogotá',
    state: 'Cundinamarca',
    postalCode: '110111',
    countryCode: 'CO',
  },
  latitude: 4.6097,
  longitude: -74.0817,
  source: 'GOOGLE_PLACES',
};

describe('LocationService', () => {
  describe('autocomplete', () => {
    it('returns empty array without calling adapter when input is too short', async () => {
      const { service, adapter } = await build();
      await expect(service.autocomplete('ab', 'tok')).resolves.toEqual([]);
      expect(adapter.autocomplete).not.toHaveBeenCalled();
    });

    it('returns empty array for empty input', async () => {
      const { service, adapter } = await build();
      await expect(service.autocomplete('', 'tok')).resolves.toEqual([]);
      expect(adapter.autocomplete).not.toHaveBeenCalled();
    });

    it('delegates to adapter with trimmed input when length >= 3', async () => {
      const { service, adapter } = await build({
        autocomplete: jest.fn().mockResolvedValue([SUGGESTION]),
      });
      const result = await service.autocomplete('  Cra 7  ', 'tok', 'co', 'es');
      expect(result).toEqual([SUGGESTION]);
      expect(adapter.autocomplete).toHaveBeenCalledWith('Cra 7', 'tok', 'co', 'es');
    });

    it('defaults region to co and language to es', async () => {
      const { service, adapter } = await build({
        autocomplete: jest.fn().mockResolvedValue([]),
      });
      await service.autocomplete('Cra 7', 'tok');
      expect(adapter.autocomplete).toHaveBeenCalledWith('Cra 7', 'tok', 'co', 'es');
    });

    it('returns empty array when Google is not configured', async () => {
      const { service } = await build({
        isConfigured: false,
        autocomplete: jest.fn().mockResolvedValue([]),
      });
      const result = await service.autocomplete('Cra 7', 'tok');
      expect(result).toEqual([]);
    });

    it('is debounce-friendly — returns array (caller handles debounce)', async () => {
      const { service } = await build({
        autocomplete: jest.fn().mockResolvedValue([SUGGESTION]),
      });
      const result = await service.autocomplete('Bogotá Centro', 'tok');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('resolvePlace', () => {
    it('returns null when adapter returns null', async () => {
      const { service } = await build({ getPlace: jest.fn().mockResolvedValue(null) });
      await expect(service.resolvePlace('p1', 'tok')).resolves.toBeNull();
    });

    it('maps Google place to normalized ResolvedLocation', async () => {
      const { service } = await build({
        getPlace: jest.fn().mockResolvedValue(RESOLVED),
      });
      const result = await service.resolvePlace('p1', 'tok');
      expect(result?.placeId).toBe('p1');
      expect(result?.latitude).toBe(4.6097);
      expect(result?.longitude).toBe(-74.0817);
      expect(result?.source).toBe('GOOGLE_PLACES');
      expect(result?.components.city).toBe('Bogotá');
      expect(result?.components.countryCode).toBe('CO');
    });

    it('defaults language to es', async () => {
      const { service, adapter } = await build({
        getPlace: jest.fn().mockResolvedValue(null),
      });
      await service.resolvePlace('p1', 'tok');
      expect(adapter.getPlace).toHaveBeenCalledWith('p1', 'tok', 'es');
    });

    it('does not expose raw Google response — returns MOVOS contract', async () => {
      const { service } = await build({
        getPlace: jest.fn().mockResolvedValue(RESOLVED),
      });
      const result = await service.resolvePlace('p1', 'tok');
      expect(result).not.toHaveProperty('html_attributions');
      expect(result).not.toHaveProperty('status');
      expect(result).toHaveProperty('placeId');
      expect(result).toHaveProperty('formattedAddress');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('latitude');
      expect(result).toHaveProperty('longitude');
      expect(result).toHaveProperty('source');
    });

    it('handles manual marker adjustment source type', async () => {
      const manualAdjusted: ResolvedLocation = {
        ...RESOLVED,
        source: 'MANUAL_ADJUSTMENT',
      };
      const { service } = await build({
        getPlace: jest.fn().mockResolvedValue(manualAdjusted),
      });
      const result = await service.resolvePlace('p1', 'tok');
      expect(result?.source).toBe('MANUAL_ADJUSTMENT');
    });
  });

  describe('mapsConfigured', () => {
    it('returns true when adapter is configured', async () => {
      const { service } = await build({ isConfigured: true });
      expect(service.mapsConfigured).toBe(true);
    });

    it('returns false when adapter is not configured', async () => {
      const { service } = await build({ isConfigured: false });
      expect(service.mapsConfigured).toBe(false);
    });

    it('API does not return API key or raw provider payload', async () => {
      const { service } = await build({
        getPlace: jest.fn().mockResolvedValue(RESOLVED),
      });
      const result = await service.resolvePlace('p1', 'tok');
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('AIza');
      expect(serialized).not.toContain('key');
    });
  });
});
