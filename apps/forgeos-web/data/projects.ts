import type { ActivityItem, Project } from '@/types';

export const evPlatform: Project = {
  id: 'ev-platform',
  name: 'MOVOS',
  status: { label: 'Foundation', tone: 'neutral' },
  pilot: 'Kylum Energy',
  priority: { label: 'Critical', tone: 'critical' },
  description:
    'MOVOS (Mobility Operating System) — the commercial white-label SaaS platform for EV charging infrastructure management. Built by MediaFOX Forge; Kylum Energy is the pilot customer.',
  capabilities: [
    'API First',
    'Multi-Tenant',
    'Multi-Operator',
    'Multi-Language',
    'Multi-Currency',
    'AI-Native',
  ],
};

export const evPlatformActivity: ActivityItem[] = [
  {
    id: 'ev-foundation',
    title: 'Foundation phase started',
    detail: 'Product scope is being structured around a white-label platform.',
    timestamp: 'Current',
  },
  {
    id: 'ev-pilot',
    title: 'Pilot context linked',
    detail: 'Kylum Energy is the first pilot customer for validation.',
    timestamp: 'Current',
  },
  {
    id: 'movos-foundation',
    title: 'MOVOS foundation established',
    detail: 'Commercial platform scaffolded at apps/movos-web (Mission 005).',
    timestamp: 'Current',
  },
];
