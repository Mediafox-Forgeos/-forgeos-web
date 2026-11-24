// Tipos de dominio de Hey Foxy (espejo del esquema SQL).
export type Role = 'owner' | 'admin' | 'analyst' | 'responder' | 'viewer';
export type Platform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'x'
  | 'web'
  | 'other';
export type ProviderId =
  | 'metricool'
  | 'meta_graph'
  | 'youtube_data'
  | 'linkedin_cm'
  | 'x_api'
  | 'licensed_feed'
  | 'demo';
export type SourceStatus =
  | 'not_connected'
  | 'pending_authorization'
  | 'connected'
  | 'insufficient_permissions'
  | 'error'
  | 'disabled';
export type DataKind =
  | 'posts'
  | 'post_metrics'
  | 'comments'
  | 'mentions'
  | 'direct_messages'
  | 'reviews';
export type CoverageStatus =
  'complete' | 'partial' | 'unavailable' | 'not_permitted' | 'not_requested';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';
export type Severity = 'info' | 'attention' | 'high' | 'critical';
export type Intent =
  | 'complaint'
  | 'question'
  | 'praise'
  | 'purchase_intent'
  | 'crisis_signal'
  | 'spam'
  | 'other';
export type ReviewStatus =
  'not_required' | 'pending' | 'confirmed' | 'dismissed' | 'adjusted';
export type IncidentStatus =
  | 'open'
  | 'acknowledged'
  | 'investigating'
  | 'responding'
  | 'monitoring'
  | 'resolved'
  | 'closed'
  | 'false_positive';
export type Layer = 'operational' | 'reputational';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  isDemo: boolean;
  retentionDays: number;
}

export interface DataSource {
  id: string;
  organizationId: string;
  provider: ProviderId;
  displayName: string;
  status: SourceStatus;
  statusReason: string | null;
  ingestionPaused: boolean;
  maxItemsPerDay: number;
}

export interface CoverageRow {
  id: string;
  organizationId: string;
  dataSourceId: string;
  provider: ProviderId;
  platform: Platform;
  dataKind: DataKind;
  status: CoverageStatus;
  reason: string | null;
  accountHandle: string | null;
  periodStart: string;
  periodEnd: string | null;
  itemsIngested: number;
}

export interface Analysis {
  sentiment: Sentiment;
  intent: Intent;
  topics: string[];
  severity: Severity;
  confidence: number;
  explanation: string;
  priorityScore: number;
  layer: Layer;
  reviewStatus: ReviewStatus;
  provider: string;
  model: string;
}

export interface ConversationItem {
  id: string;
  organizationId: string;
  kind: 'comment' | 'mention';
  platform: Platform;
  provider: ProviderId;
  brand: string | null;
  body: string;
  authorDisplay: string | null;
  publishedAt: string;
  permalink: string | null;
  isSynthetic: boolean;
  analysis: Analysis | null;
  /** Publicación a la que pertenece el comentario (null en menciones o si no se conoce). */
  postId?: string | null;
}

export interface PostMetrics {
  capturedAt: string;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
  reach: number | null;
}

export interface Post {
  id: string;
  organizationId: string;
  platform: Platform;
  accountHandle: string | null;
  body: string | null;
  permalink: string | null;
  publishedAt: string | null;
  isSynthetic: boolean;
  /** Serie de métricas, de la más reciente a la más antigua. */
  metrics: PostMetrics[];
  /**
   * Medios de la publicación, solo si la fuente los entrega y los permisos lo permiten.
   * Ninguna fuente los entrega todavía (sin columna en el esquema; Metricool sin conectar):
   * la interfaz muestra un fallback con enlace al original. Nunca se inventan.
   */
  media?: PostMediaItem[];
  /** Autor o cuenta de la publicación, si la fuente lo entrega. */
  author?: PostAuthor | null;
}

/** Un medio de una publicación (varios = carrusel). */
export interface PostMediaItem {
  kind: 'image' | 'video';
  url: string;
  /** Miniatura o póster (obligatorio para mostrar un video sin descargarlo). */
  previewUrl?: string | null;
  /** Texto alternativo entregado por la fuente; sin él se usa una descripción genérica. */
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  /**
   * false si la fuente solo entrega la miniatura de un video (Metricool): se muestra la
   * miniatura con su duración y el enlace al original, sin reproductor.
   */
  playable?: boolean;
}

export interface PostAuthor {
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
}

export interface DailyReport {
  id: string;
  organizationId: string;
  reportDate: string;
  summary: string;
  coverageNote: string;
  metrics: Record<string, number>;
  isSynthetic: boolean;
}

export interface Alert {
  id: string;
  organizationId: string;
  title: string;
  summary: string;
  severity: Severity;
  priorityScore: number;
  reviewStatus: ReviewStatus;
  createdAt: string;
  isSynthetic: boolean;
  itemIds: string[];
  incidentId: string | null;
}

export interface IncidentEvent {
  id: string;
  kind:
    'opened' | 'status_changed' | 'assigned' | 'note' | 'notified' | 'closed';
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus | null;
  body: string | null;
  actor: string | null;
  createdAt: string;
}

export interface Incident {
  id: string;
  organizationId: string;
  alertId: string | null;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  owner: string | null;
  openedAt: string;
  closedAt: string | null;
  resolutionSummary: string | null;
  isSynthetic: boolean;
  events: IncidentEvent[];
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
}
