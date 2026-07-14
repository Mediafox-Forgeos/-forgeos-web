export type Currency = 'COP' | 'USD' | 'EUR';

export type TariffStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export type Tariff = {
  id: string;
  name: string;
  currency: Currency;
  energyPricePerKwh: number;
  timePricePerMinute: number;
  sessionFee: number;
  applicableSiteIds: string[];
  status: TariffStatus;
  isDemo: true;
};
