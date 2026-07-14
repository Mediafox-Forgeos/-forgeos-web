import type { ComponentType } from 'react';

export type NavigationItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

export type WorkspaceMetric = {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
};
