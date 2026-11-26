import type { NormalizedComment, NormalizedPost } from '@/lib/connectors/types';
import type { CoverageStatus, DataKind, Platform } from '@/lib/types';

/** Estado de conexión de la fuente Metricool de una organización (sin secretos). */
export type ConnectionStatus =
  | 'not_connected'
  | 'connected'
  | 'insufficient_permissions'
  | 'error'
  | 'disconnected';

export type SyncRunStatus =
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'stopped'
  | 'skipped_paused'
  | 'skipped_kill_switch'
  | 'skipped_budget'
  | 'skipped_not_connected'
  | 'skipped_not_authorized';

export interface SyncBrand {
  blogId: string;
  label: string;
  networks: Platform[];
  tokenExpirations: Partial<Record<Platform, string>>;
}

export interface SyncCursor {
  /** Fin de la última ventana de publicaciones sincronizada con éxito, por red. */
  postsTo?: Partial<Record<Platform, string>>;
  /** Fecha del comentario más reciente ya importado, por red. */
  commentsSince?: Partial<Record<Platform, string>>;
}

export interface SourceSyncState {
  status: ConnectionStatus;
  statusReason: string | null;
  paused: boolean;
  brand: SyncBrand | null;
  cursor: SyncCursor;
  apiCallsDate: string | null;
  apiCallsToday: number;
  maxApiCallsPerDay: number;
  itemsDate: string | null;
  itemsToday: number;
  maxItemsPerDay: number;
  consecutiveFailures: number;
  lastSyncStartedAt: string | null;
  lastSyncFinishedAt: string | null;
  lastSyncStatus: SyncRunStatus | null;
  lastSyncError: string | null;
}

export interface CoverageCell {
  platform: Platform;
  dataKind: DataKind;
  status: CoverageStatus;
  reason: string;
  items: number;
}

export interface SyncError {
  platform: Platform | null;
  dataKind: DataKind | null;
  kind: string;
  message: string;
  retryable: boolean;
}

export interface SyncRun {
  id: string;
  trigger: 'manual' | 'scheduled';
  status: SyncRunStatus;
  startedAt: string;
  finishedAt: string;
  postsInserted: number;
  postsUpdated: number;
  snapshots: number;
  commentsInserted: number;
  duplicates: number;
  overLimit: number;
  apiCalls: number;
  /** Datos personales enmascarados en comentarios (solo con protección activa). */
  redactions?: number;
  /** Comentarios cuyo texto no se guardó por contener información de salud. */
  healthWithheld?: number;
  errors: SyncError[];
}

export interface StoredPost extends NormalizedPost {
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface StoredComment extends NormalizedComment {
  contentHash: string;
  importedAt: string;
}

/**
 * Persistencia de la sincronización. La implementación de memoria se usa en pruebas y en la
 * simulación del modo demo; la de Supabase (servidor, service role) requiere la migración 0006.
 * Todas las operaciones van acotadas a una organización.
 */
export interface SyncStore {
  load(orgId: string): Promise<SourceSyncState | null>;
  save(orgId: string, patch: Partial<SourceSyncState>): Promise<void>;
  /** Inserta o actualiza por (red, id externo) y añade una medición de métricas. */
  upsertPosts(
    orgId: string,
    posts: NormalizedPost[],
    at: string,
  ): Promise<{ inserted: number; updated: number; snapshots: number }>;
  /** Completa medios de publicaciones ya guardadas (carruseles vistos en los hilos). */
  enrichPostMedia(
    orgId: string,
    platform: Platform,
    media: Map<string, string[]>,
  ): Promise<number>;
  knownComments(
    orgId: string,
  ): Promise<{ ids: Set<string>; authorHashes: Set<string> }>;
  insertComments(
    orgId: string,
    comments: Array<NormalizedComment & { contentHash: string }>,
    at: string,
  ): Promise<number>;
  replaceCoverage(orgId: string, cells: CoverageCell[]): Promise<void>;
  recordRun(orgId: string, run: SyncRun): Promise<void>;
  runs(orgId: string, limit?: number): Promise<SyncRun[]>;
  counts(
    orgId: string,
  ): Promise<{ posts: number; comments: number; snapshots: number }>;
  coverage(orgId: string): Promise<CoverageCell[]>;
  posts(orgId: string): Promise<StoredPost[]>;
  /**
   * Seudónimo del autor (minimización de PII). Si existe, el motor deduplica y guarda con él;
   * la implementación de Supabase usa HMAC por organización (`author_hash`).
   */
  authorKey?(
    orgId: string,
    platform: Platform,
    authorExternalId: string | null,
  ): string | null;
  /** Interruptor de emergencia global guardado en la base (efecto inmediato, sin redesplegar). */
  globalKillSwitch?(): Promise<boolean>;
  /** true si la organización es de demostración (nunca admite datos reales). */
  isDemoOrg?(orgId: string): Promise<boolean>;
}

export function initialState(
  over: Partial<SourceSyncState> = {},
): SourceSyncState {
  return {
    status: 'not_connected',
    statusReason: null,
    paused: false,
    brand: null,
    cursor: {},
    apiCallsDate: null,
    apiCallsToday: 0,
    maxApiCallsPerDay: 500,
    itemsDate: null,
    itemsToday: 0,
    maxItemsPerDay: 5000,
    consecutiveFailures: 0,
    lastSyncStartedAt: null,
    lastSyncFinishedAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    ...over,
  };
}
