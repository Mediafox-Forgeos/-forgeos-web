import type {
  CoverageStatus,
  DataKind,
  Platform,
  ProviderId,
} from '@/lib/types';

/**
 * Contrato de proveedor de datos (requisito: Metricool sustituible o
 * complementable por APIs oficiales). Ningún conector puede escribir en la
 * red social: la interfaz solo expone lecturas.
 */
export interface ProviderCapability {
  platform: Platform;
  dataKind: DataKind;
  /** Qué tan completa es la cobertura que el proveedor PUEDE dar, en teoría. */
  maxCoverage: CoverageStatus;
  ownership: 'owned' | 'public_reference';
  note: string;
}

export interface FetchWindow {
  from: Date;
  to: Date;
  timezone: string;
  cursor?: string | null;
  limit: number;
}

export type ContentType =
  | 'image'
  | 'video'
  | 'carousel'
  | 'reel'
  | 'story'
  | 'text'
  | 'link'
  | 'unknown';

/** Medio entregado por la fuente (nunca se inventa). */
export interface NormalizedMedia {
  kind: 'image' | 'video';
  sourceUrl: string;
  previewUrl?: string | null;
  durationSec?: number | null;
}

export interface NormalizedPost {
  externalId: string;
  platform: Platform;
  accountExternalId: string | null;
  body: string | null;
  permalink: string | null;
  publishedAt: string | null;
  contentType?: ContentType;
  title?: string | null;
  author?: {
    display: string | null;
    handle: string | null;
    avatarUrl: string | null;
  } | null;
  /** Medios entregados (puede ser parcial: p. ej. una sola imagen de un carrusel). */
  media?: NormalizedMedia[];
  /** Cuántos medios declara la fuente, si lo declara (para avisar de carruseles parciales). */
  mediaCountReported?: number | null;
  metrics: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
    /** Alcance real (Instagram). Nunca se rellena con impresiones únicas. */
    reach?: number;
    impressions?: number;
    impressionsUnique?: number;
    interactions?: number;
    saves?: number;
    videoViews?: number;
    engagement?: number;
    reactions?: Record<string, number>;
  };
}

export interface NormalizedComment {
  externalId: string;
  parentExternalId: string | null;
  postExternalId: string | null;
  platform: Platform;
  body: string;
  /** Identificador de autor en la red; se seudonimiza antes de persistir. */
  authorExternalId: string | null;
  authorDisplay: string | null;
  publishedAt: string;
  permalink: string | null;
  mediaUrl?: string | null;
}

export interface FetchPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AuthorizationCheck {
  platform: Platform;
  dataKind: DataKind;
  granted: boolean;
  detail: string;
}

export interface SourceConnector {
  readonly provider: ProviderId;
  readonly displayName: string;
  /** false si falta habilitación explícita (feature flag) o credenciales. */
  isEnabled(): boolean;
  capabilities(): ProviderCapability[];
  /** Verifica permisos efectivos sin leer contenido. */
  checkAuthorizations(platforms: Platform[]): Promise<AuthorizationCheck[]>;
  fetchPosts(
    platform: Platform,
    window: FetchWindow,
  ): Promise<FetchPage<NormalizedPost>>;
  fetchComments(
    platform: Platform,
    window: FetchWindow,
  ): Promise<FetchPage<NormalizedComment>>;
}

export class ConnectorDisabledError extends Error {
  constructor(provider: ProviderId, reason: string) {
    super(`Conector ${provider} deshabilitado: ${reason}`);
    this.name = 'ConnectorDisabledError';
  }
}
