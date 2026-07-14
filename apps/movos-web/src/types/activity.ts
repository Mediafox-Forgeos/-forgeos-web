export type ActivityKind = 'session' | 'alert' | 'charger' | 'system' | 'user';

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  timestamp: string;
  siteId: string | null;
  isDemo: true;
};
