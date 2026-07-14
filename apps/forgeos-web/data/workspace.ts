import type { ActivityItem, Sprint } from '@/types';

export const currentSprint: Sprint = {
  name: 'Sprint 01 — Foundation',
  priority: 'Build EV Platform while evolving ForgeOS.',
  milestones: [
    'ARGOS GPT',
    'Domain Model',
    'Authentication',
    'Backend Bootstrap',
  ],
  tasks: [
    { id: 'github-org', label: 'GitHub Organization', completed: true },
    { id: 'first-deployment', label: 'First Deployment', completed: true },
    { id: 'forgeos-alpha', label: 'ForgeOS Alpha', completed: true },
    { id: 'argos-gpt', label: 'ARGOS GPT', completed: false },
    { id: 'domain-model', label: 'Domain Model', completed: false },
    { id: 'authentication', label: 'Authentication', completed: false },
    { id: 'backend-bootstrap', label: 'Backend Bootstrap', completed: false },
  ],
};

export const workspaceRecentActivity: ActivityItem[] = [
  {
    id: 'workspace-sprint',
    title: 'Foundation sprint is active',
    detail: 'The workspace is aligned around the EV Platform foundation.',
    timestamp: 'Current',
  },
  {
    id: 'workspace-forgeos',
    title: 'ForgeOS Alpha established',
    detail: 'ARGOS is now the primary operational surface.',
    timestamp: 'Current',
  },
];
