import type { Tariff } from '@/types';

/** Demo tariff definitions in COP. Not production data. */
export const tariffs: Tariff[] = [
  {
    id: 'tariff-01',
    name: 'Flota corporativa',
    currency: 'COP',
    energyPricePerKwh: 1250,
    timePricePerMinute: 0,
    sessionFee: 0,
    applicableSiteIds: ['site-01', 'site-02'],
    status: 'ACTIVE',
    isDemo: true,
  },
  {
    id: 'tariff-02',
    name: 'Público estándar',
    currency: 'COP',
    energyPricePerKwh: 1680,
    timePricePerMinute: 120,
    sessionFee: 2000,
    applicableSiteIds: ['site-01'],
    status: 'ACTIVE',
    isDemo: true,
  },
];

export function getTariffById(id: string): Tariff | undefined {
  return tariffs.find((tariff) => tariff.id === id);
}
