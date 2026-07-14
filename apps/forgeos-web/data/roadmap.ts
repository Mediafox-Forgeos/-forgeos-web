import type { RoadmapPhase } from '@/types';

export const roadmapPhases: RoadmapPhase[] = [
  {
    name: 'Foundation',
    detail: 'Product, domain and platform foundations.',
    status: { label: 'Current', tone: 'neutral' },
  },
  {
    name: 'Core Platform',
    detail: 'Core operational capabilities and tenancy.',
    status: { label: 'Next', tone: 'pending' },
  },
  {
    name: 'OCPP',
    detail: 'Charging protocol integration layer.',
    status: { label: 'Planned', tone: 'pending' },
  },
  {
    name: 'Pilot',
    detail: 'Pilot validation with Kylum Energy.',
    status: { label: 'Planned', tone: 'pending' },
  },
];
