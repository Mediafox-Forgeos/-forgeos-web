import type {
  Alert,
  ConversationItem,
  CoverageRow,
  DataSource,
  Incident,
  IncidentStatus,
  Member,
  Organization,
  Role,
  Sentiment,
  Severity,
  Layer,
  Platform,
} from '@/lib/types';
import type { WaDispatch, WaRecipient } from '@/lib/whatsapp/notifier';

export interface Viewer {
  userId: string;
  name: string;
  email: string;
  mode: 'demo' | 'supabase';
}

export interface Membership {
  organization: Organization;
  role: Role;
}

export interface ItemFilters {
  q?: string;
  platform?: Platform;
  sentiment?: Sentiment;
  severity?: Severity;
  layer?: Layer;
  reviewPending?: boolean;
  limit?: number;
}

export interface UsageSummary {
  aiMonthlyUsdLimit: number;
  aiMonthlyUsdSpent: number;
  aiDailyItemsLimit: number;
  aiDailyItemsUsed: number;
  cacheHits: number;
  whatsappMonthlyUsdLimit: number;
  provider: string;
  model: string;
}

/**
 * Acceso a datos. Toda operación recibe organizationId explícito y la
 * implementación Supabase delega la autorización en RLS (sesión del usuario).
 */
export interface Repository {
  memberships(viewer: Viewer): Promise<Membership[]>;
  items(orgId: string, f?: ItemFilters): Promise<ConversationItem[]>;
  alerts(orgId: string): Promise<Alert[]>;
  reviewAlert(
    orgId: string,
    alertId: string,
    decision: 'confirmed' | 'dismissed',
    viewer: Viewer,
  ): Promise<void>;
  incidents(orgId: string): Promise<Incident[]>;
  incident(orgId: string, id: string): Promise<Incident | null>;
  openIncidentFromAlert(
    orgId: string,
    alertId: string,
    viewer: Viewer,
  ): Promise<string>;
  transitionIncident(
    orgId: string,
    id: string,
    to: IncidentStatus,
    viewer: Viewer,
    resolution?: string,
  ): Promise<void>;
  assignIncident(
    orgId: string,
    id: string,
    ownerUserId: string,
    viewer: Viewer,
  ): Promise<void>;
  addIncidentNote(
    orgId: string,
    id: string,
    body: string,
    viewer: Viewer,
  ): Promise<void>;
  sources(orgId: string): Promise<DataSource[]>;
  coverage(orgId: string): Promise<CoverageRow[]>;
  members(orgId: string): Promise<Member[]>;
  usage(orgId: string): Promise<UsageSummary>;
  waRecipients(orgId: string): Promise<WaRecipient[]>;
  waDispatches(orgId: string): Promise<WaDispatch[]>;
}
