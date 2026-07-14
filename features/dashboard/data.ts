import { Bot, BriefcaseBusiness, FolderKanban, Workflow } from 'lucide-react';

import type { WorkspaceMetric } from '@/types';

export const workspaceMetrics: WorkspaceMetric[] = [
  {
    label: 'Clientes activos',
    value: '12',
    detail: '+2 este mes',
    icon: BriefcaseBusiness,
  },
  {
    label: 'Proyectos activos',
    value: '8',
    detail: '3 en revisión',
    icon: FolderKanban,
  },
  {
    label: 'Automatizaciones',
    value: '24',
    detail: 'Todas operativas',
    icon: Workflow,
  },
  { label: 'Agentes', value: '6', detail: '2 trabajando ahora', icon: Bot },
];
