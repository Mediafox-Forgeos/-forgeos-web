import type { ConnectorStatus } from './connector';

export type MetricTrend = 'up' | 'down' | 'flat';

export type NetworkMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  trend: MetricTrend;
};

export type NetworkDistribution = {
  status: ConnectorStatus;
  label: string;
  count: number;
};

export type PilotMilestoneStatus = 'DONE' | 'IN_PROGRESS' | 'PENDING';

export type PilotMilestone = {
  id: string;
  label: string;
  status: PilotMilestoneStatus;
};

export type ReportCard = {
  id: string;
  title: string;
  description: string;
  available: boolean;
};
