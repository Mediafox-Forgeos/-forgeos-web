export type SiteStatus = 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE' | 'OFFLINE';

export type Site = {
  id: string;
  organizationId: string;
  name: string;
  city: string;
  address: string;
  status: SiteStatus;
  stationCount: number;
  chargerCount: number;
  availableConnectors: number;
  totalConnectors: number;
  openAlerts: number;
  isDemo: true;
};
