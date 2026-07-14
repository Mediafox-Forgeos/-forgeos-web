import type { ActivityItem, Metric } from '@/types';

export const argosQuickActions = [
  'Review current sprint',
  'Review EV Platform',
  'Analyze Kylum risks',
  'Create Technical Decision',
] as const;

export const executiveMetrics: Metric[] = [
  { label: 'Sprint', value: 'Sprint 01 — Foundation', detail: 'Current focus' },
  { label: 'Main Product', value: 'EV Platform', detail: 'White-label SaaS' },
  { label: 'Pilot Customer', value: 'Kylum Energy', detail: 'Pilot customer' },
  { label: 'Open Risks', value: '3', detail: 'Requires attention' },
  { label: 'Pending Decisions', value: '2', detail: 'Awaiting review' },
  { label: 'Architecture', value: 'Healthy', detail: 'Current assessment' },
];

export const argosRecentActivity: ActivityItem[] = [
  {
    id: 'deployment',
    title: 'First deployment completed',
    detail: 'ForgeOS Alpha is available in production.',
    timestamp: 'Today',
  },
  {
    id: 'foundation',
    title: 'Sprint 01 started',
    detail: 'Foundation work is now the active workspace focus.',
    timestamp: 'Today',
  },
  {
    id: 'kylum',
    title: 'Kylum classified as pilot customer',
    detail: 'Kylum informs the product, but is not the product.',
    timestamp: 'Today',
  },
];
