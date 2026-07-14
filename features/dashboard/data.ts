import { Bot, BriefcaseBusiness, FolderKanban, Workflow } from 'lucide-react';

import type { WorkspaceMetric } from '@/types';

export const workspaceMetrics: WorkspaceMetric[] = [
  {
    label: 'Clientes',
    value: '12',
    detail: 'activos ahora',
    icon: BriefcaseBusiness,
  },
  {
    label: 'Proyectos',
    value: '8',
    detail: 'en curso',
    icon: FolderKanban,
  },
  {
    label: 'Automatizaciones',
    value: '24',
    detail: 'ejecutándose',
    icon: Workflow,
  },
  { label: 'Agentes', value: '6', detail: 'disponibles', icon: Bot },
];
