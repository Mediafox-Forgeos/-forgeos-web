import type { ActivityItem, Project } from '@/types';

export const evPlatform: Project = {
  id: 'ev-platform',
  name: 'EV Platform',
  status: { label: 'Foundation', tone: 'neutral' },
  pilot: 'Kylum Energy',
  priority: { label: 'Critical', tone: 'critical' },
  description:
    'White-label SaaS platform for Electric Vehicle Charging Infrastructure Management.',
  capabilities: [
    'API First',
    'Multi-Tenant',
    'Multi-Operator',
    'Multi-Language',
    'Multi-Currency',
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
];
