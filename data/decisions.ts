import type { Decision } from '@/types';

export const decisions: Decision[] = [
  {
    id: 'ADR-0001',
    title: 'ForgeOS evolves together with products.',
    status: { label: 'Approved', tone: 'healthy' },
  },
  {
    id: 'ADR-0002',
    title: 'EV Platform is White Label.',
    status: { label: 'Approved', tone: 'healthy' },
  },
  {
    id: 'ADR-0003',
    title: 'Kylum is Pilot Customer.',
    status: { label: 'Approved', tone: 'healthy' },
  },
  {
    id: 'ADR-0004',
    title: 'Technology Stack',
    status: { label: 'Pending', tone: 'pending' },
  },
];
