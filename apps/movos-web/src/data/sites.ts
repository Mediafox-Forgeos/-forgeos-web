import type { Site } from '@/types';

/** Demo pilot sites — Colombian locations. Not production data. */
export const sites: Site[] = [
  {
    id: 'site-01',
    organizationId: 'org-kylum',
    name: 'Centro Logístico Norte',
    city: 'Bogotá',
    address: 'Autopista Norte Km 21, Bogotá D.C.',
    status: 'OPERATIONAL',
    stationCount: 2,
    chargerCount: 4,
    availableConnectors: 5,
    totalConnectors: 7,
    openAlerts: 1,
    isDemo: true,
  },
  {
    id: 'site-02',
    organizationId: 'org-kylum',
    name: 'Terminal Sur Medellín',
    city: 'Medellín',
    address: 'Cra 65 # 8B-91, Medellín, Antioquia',
    status: 'DEGRADED',
    stationCount: 1,
    chargerCount: 2,
    availableConnectors: 1,
    totalConnectors: 3,
    openAlerts: 0,
    isDemo: true,
  },
];

export function getSiteById(id: string): Site | undefined {
  return sites.find((site) => site.id === id);
}
