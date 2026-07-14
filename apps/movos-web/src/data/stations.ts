import type { Station } from '@/types';

/** Demo stations across the pilot sites. Not production data. */
export const stations: Station[] = [
  {
    id: 'station-01',
    siteId: 'site-01',
    name: 'Bahía Norte A',
    status: 'ONLINE',
    chargerCount: 2,
    connectorCount: 4,
    availabilityPercent: 75,
    lastCommunication: '2026-07-14T13:52:00-05:00',
    isDemo: true,
  },
  {
    id: 'station-02',
    siteId: 'site-01',
    name: 'Bahía Norte B',
    status: 'PARTIAL',
    chargerCount: 2,
    connectorCount: 3,
    availabilityPercent: 66,
    lastCommunication: '2026-07-14T13:49:00-05:00',
    isDemo: true,
  },
  {
    id: 'station-03',
    siteId: 'site-02',
    name: 'Terminal Sur A',
    status: 'PARTIAL',
    chargerCount: 2,
    connectorCount: 3,
    availabilityPercent: 33,
    lastCommunication: '2026-07-14T13:30:00-05:00',
    isDemo: true,
  },
];

export function getStationsBySite(siteId: string): Station[] {
  return stations.filter((station) => station.siteId === siteId);
}
