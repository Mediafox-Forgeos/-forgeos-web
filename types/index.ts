import type { ComponentType } from 'react';

export type NavigationItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

export type StatusTone = 'neutral' | 'healthy' | 'critical' | 'pending';

export type Status = {
  label: string;
  tone?: StatusTone;
};

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
};

export type Metric = {
  label: string;
  value: string;
  detail: string;
};

export type SprintTask = {
  id: string;
  label: string;
  completed: boolean;
};

export type Sprint = {
  name: string;
  priority: string;
  milestones: string[];
  tasks: SprintTask[];
};

export type Project = {
  id: string;
  name: string;
  status: Status;
  pilot: string;
  priority: Status;
  description: string;
  capabilities: string[];
};

export type Client = {
  id: string;
  name: string;
  status: Status;
  note: string;
};

export type RoadmapPhase = {
  name: string;
  detail: string;
  status: Status;
};

export type Decision = {
  id: string;
  title: string;
  status: Status;
};

export type KnowledgeCategory = {
  name: string;
  description: string;
};
