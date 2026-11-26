import type { Platform } from '@/lib/types';
import { applicableMetrics } from '@/lib/metrics-applicability';
import {
  ConnectorDisabledError,
  type AuthorizationCheck,
  type ContentType,
  type FetchPage,
  type FetchWindow,
  type NormalizedComment,
  type NormalizedMedia,
  type NormalizedPost,
  type ProviderCapability,
  type SourceConnector,
} from './types';

/**
 * Conector Metricool (plan Advanced). Verificado contra la especificación OpenAPI oficial
 * (https://app.metricool.com/api/swagger.json, v2.0.0, revisada el 2026-11-24; doc 16).
 *
 * Seguridad:
 *  - SOLO lectura. Metricool expone acciones de escritura incluso vía GET
 *    (p. ej. /stats/deletecomment, /stats/facebook/boost = campaña PAGADA,
 *    /stats/twitter/follow, /admin/delete-profile). Lista blanca cerrada de rutas;
 *    cualquier otra ruta se rechaza antes de la red, y solo se emite GET.
 *  - El token (X-Mc-Auth) nunca sale del servidor ni aparece en errores o registros.
 *  - Deshabilitado salvo HF_CONNECTOR_METRICOOL_ENABLED=true + credenciales.
 *
 * Resiliencia y consumo: reintentos con espera exponencial ante 429/5xx/red (no ante
 * credenciales inválidas), ritmo mínimo entre llamadas y presupuesto de llamadas por ejecución.
 */
export const METRICOOL_BASE_URL = 'https://app.metricool.com/api';

export const METRICOOL_READ_ALLOWLIST: readonly RegExp[] = [
  /^\/admin\/simpleProfiles$/,
  /^\/v2\/inbox\/post-comments$/,
  /^\/v2\/inbox\/post-comments\/authorizations$/,
  /^\/v2\/analytics\/posts\/(facebook|instagram|linkedin|tiktok|twitter|threads|bluesky|pinterest)$/,
  /^\/v2\/analytics\/reels\/(facebook|instagram)$/,
  /^\/v2\/analytics\/timelines$/,
  /^\/v2\/analytics\/aggregation$/,
  /^\/v2\/settings\/users\/\d+\/api-usage-stats$/,
];

export function isAllowedMetricoolPath(path: string): boolean {
  return METRICOOL_READ_ALLOWLIST.some((re) => re.test(path));
}

/** Nombre de red en Metricool para cada plataforma Hey Foxy. */
export const MC_PROVIDER: Partial<Record<Platform, string>> = {
  facebook: 'facebook',
  instagram: 'instagram',
  linkedin: 'linkedin',
  youtube: 'youtube',
  tiktok: 'tiktok',
  x: 'twitter',
};

/**
 * Redes cuyas publicaciones se leen en esta fase (JSON tipado en la especificación).
 * TikTok y X solo ofrecen CSV en v2; LinkedIn JSON (`/stats/linkedin/posts`) no documenta
 * parámetros; YouTube v2 no figura en la especificación. Se declaran «no disponibles» con motivo.
 */
export const POSTS_SUPPORTED: readonly Platform[] = ['instagram', 'facebook'];
export const POSTS_UNSUPPORTED_REASON: Partial<Record<Platform, string>> = {
  tiktok:
    'Metricool solo entrega CSV para TikTok (sin esquema): pendiente de lector validado',
  x: 'Metricool solo entrega CSV en v2 (el JSON está obsoleto): pendiente de lector validado',
  linkedin:
    'El endpoint JSON no documenta parámetros: se confirma con la cuenta real',
  youtube:
    'El endpoint v2 de YouTube no figura en la especificación: se confirma con la cuenta real',
};

export type MetricoolErrorKind =
  | 'auth'
  | 'rate_limit'
  | 'server'
  | 'network'
  | 'bad_response'
  | 'budget'
  | 'brand_not_authorized';

/** Error tipado. El mensaje nunca contiene el token, la URL completa ni los ids. */
export class MetricoolError extends Error {
  constructor(
    readonly kind: MetricoolErrorKind,
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'MetricoolError';
  }
  get retryable() {
    return (
      this.kind === 'rate_limit' ||
      this.kind === 'server' ||
      this.kind === 'network'
    );
  }
}

/** Presupuesto de llamadas compartido por una ejecución de sincronización. */
export interface CallBudget {
  remaining: number;
  used: number;
}

export interface MetricoolConfig {
  enabled: boolean;
  token: string | null;
  userId: string | null;
  blogId: string | null;
  fetchImpl?: typeof fetch;
  /** Límite defensivo propio; Metricool no publica límites de tasa. */
  minIntervalMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  budget?: CallBudget;
  /**
   * Marcas (blogId) autorizadas para esta organización. Si se indica, ninguna llamada con marca
   * sale a la red para un blogId fuera de la lista (defensa en profundidad del motor).
   */
  allowedBlogIds?: readonly string[];
}

export function metricoolConfigFromEnv(secret: {
  token: string | null;
  userId: string | null;
  blogId: string | null;
}): MetricoolConfig {
  return {
    enabled: process.env.HF_CONNECTOR_METRICOOL_ENABLED === 'true',
    ...secret,
  };
}

// Esquemas de respuesta usados (subconjunto de la especificación).
interface McParticipant {
  id?: string;
  name?: string;
  imageProfileUrl?: string;
}
interface McComment {
  id?: string;
  parentId?: string;
  creationDate?: string;
  owner?: string;
  text?: string;
  mediaUrl?: string;
}
export interface McThread {
  id?: string;
  provider?: string;
  participants?: McParticipant[];
  root?: {
    id?: string;
    element?: {
      id?: string;
      link?: string;
      text?: string;
      mediaUrls?: string[];
      commentCount?: number;
    };
    creationDate?: string;
    owner?: string;
    text?: string;
    mediaUrl?: string;
    comments?: McComment[];
  };
}
interface McListResponse<T> {
  data?: T[];
  page?: { next?: string | null };
}

/** Marca de Metricool (blogId) con las redes conectadas. Sin secretos. */
export interface MetricoolBrand {
  blogId: string;
  label: string;
  pictureUrl: string | null;
  networks: Platform[];
  /** Caducidad de tokens de red que Metricool informa (TikTok, LinkedIn). */
  tokenExpirations: Partial<Record<Platform, string>>;
  /** Usuario y nombre por red, si Metricool los entrega (`instagram`, `facebook`…). */
  accounts: Partial<
    Record<Platform, { handle: string | null; name: string | null }>
  >;
}

const defaultSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MetricoolConnector implements SourceConnector {
  readonly provider = 'metricool' as const;
  readonly displayName = 'Metricool (Advanced)';
  private lastCallAt = 0;
  /** Llamadas de red hechas por esta instancia (incluye reintentos). */
  callsMade = 0;

  constructor(private readonly cfg: MetricoolConfig) {}

  /** Puede autenticarse (sin marca elegida todavía). */
  canAuthenticate(): boolean {
    return Boolean(this.cfg.enabled && this.cfg.token && this.cfg.userId);
  }

  isEnabled(): boolean {
    return this.canAuthenticate() && Boolean(this.cfg.blogId);
  }

  capabilities(): ProviderCapability[] {
    const note =
      'Solo cuentas propias conectadas en Metricool; sujeto a permisos por red.';
    return [
      {
        platform: 'facebook',
        dataKind: 'posts',
        maxCoverage: 'complete',
        ownership: 'owned',
        note,
      },
      {
        platform: 'facebook',
        dataKind: 'comments',
        maxCoverage: 'partial',
        ownership: 'owned',
        note: 'Inbox post-comments; depende de permisos de página.',
      },
      {
        platform: 'instagram',
        dataKind: 'posts',
        maxCoverage: 'complete',
        ownership: 'owned',
        note,
      },
      {
        platform: 'instagram',
        dataKind: 'comments',
        maxCoverage: 'partial',
        ownership: 'owned',
        note: 'Inbox post-comments; depende de permisos de la cuenta profesional.',
      },
      {
        platform: 'linkedin',
        dataKind: 'posts',
        maxCoverage: 'partial',
        ownership: 'owned',
        note: POSTS_UNSUPPORTED_REASON.linkedin!,
      },
      {
        platform: 'linkedin',
        dataKind: 'comments',
        maxCoverage: 'partial',
        ownership: 'owned',
        note: 'Por confirmar con /authorizations.',
      },
      {
        platform: 'tiktok',
        dataKind: 'posts',
        maxCoverage: 'partial',
        ownership: 'owned',
        note: POSTS_UNSUPPORTED_REASON.tiktok!,
      },
      {
        platform: 'tiktok',
        dataKind: 'comments',
        maxCoverage: 'partial',
        ownership: 'owned',
        note: 'Por confirmar con /authorizations.',
      },
      {
        platform: 'youtube',
        dataKind: 'comments',
        maxCoverage: 'partial',
        ownership: 'owned',
        note: 'Por confirmar con /authorizations.',
      },
      {
        platform: 'instagram',
        dataKind: 'mentions',
        maxCoverage: 'unavailable',
        ownership: 'owned',
        note: 'Metricool no expone menciones de terceros por API.',
      },
      {
        platform: 'facebook',
        dataKind: 'posts',
        maxCoverage: 'partial',
        ownership: 'public_reference',
        note: 'Competidores: solo publicaciones y métricas públicas, sin comentarios.',
      },
    ];
  }

  private async get<T>(
    path: string,
    query: Record<string, string>,
    opts: { requireBrand?: boolean } = {},
  ): Promise<T> {
    const requireBrand = opts.requireBrand ?? true;
    if (!(requireBrand ? this.isEnabled() : this.canAuthenticate())) {
      throw new ConnectorDisabledError(
        'metricool',
        'falta habilitación o credenciales',
      );
    }
    if (
      requireBrand &&
      this.cfg.allowedBlogIds &&
      !this.cfg.allowedBlogIds.includes(String(this.cfg.blogId))
    ) {
      throw new MetricoolError(
        'brand_not_authorized',
        'Marca de Metricool no autorizada para esta organización',
      );
    }
    if (!isAllowedMetricoolPath(path)) {
      throw new Error(`Ruta Metricool no permitida (solo lectura): ${path}`);
    }
    const sleep = this.cfg.sleep ?? defaultSleep;
    const maxRetries = this.cfg.maxRetries ?? 3;
    const base = this.cfg.retryBaseMs ?? 1000;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.once<T>(path, query, requireBrand);
      } catch (e) {
        const err =
          e instanceof MetricoolError
            ? e
            : new MetricoolError('network', `Metricool ${path}: error de red`);
        if (!err.retryable || attempt >= maxRetries) throw err;
        await sleep(err.retryAfterMs ?? base * 2 ** attempt);
      }
    }
  }

  private async once<T>(
    path: string,
    query: Record<string, string>,
    withBrand: boolean,
  ): Promise<T> {
    const budget = this.cfg.budget;
    if (budget && budget.remaining <= 0) {
      throw new MetricoolError(
        'budget',
        'Presupuesto de llamadas a Metricool agotado para esta ejecución',
      );
    }
    const sleep = this.cfg.sleep ?? defaultSleep;
    const wait =
      (this.cfg.minIntervalMs ?? 1000) - (Date.now() - this.lastCallAt);
    if (wait > 0) await sleep(wait);
    this.lastCallAt = Date.now();

    const url = new URL(METRICOOL_BASE_URL + path);
    url.searchParams.set('userId', this.cfg.userId!);
    if (withBrand) url.searchParams.set('blogId', this.cfg.blogId!);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

    this.callsMade++;
    if (budget) {
      budget.remaining--;
      budget.used++;
    }
    let res: Response;
    try {
      res = await (this.cfg.fetchImpl ?? fetch)(url, {
        method: 'GET',
        headers: { 'X-Mc-Auth': this.cfg.token!, Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch {
      throw new MetricoolError('network', `Metricool ${path}: error de red`);
    }
    if (!res.ok) {
      // Nunca incluir cabeceras ni URL completa (contiene ids) en el error.
      const s = res.status;
      if (s === 401 || s === 403)
        throw new MetricoolError(
          'auth',
          `Metricool ${path} respondió ${s}: credenciales inválidas, caducadas o sin permiso`,
          s,
        );
      if (s === 429) {
        const ra = Number(res.headers.get('retry-after'));
        throw new MetricoolError(
          'rate_limit',
          `Metricool ${path} respondió 429: límite de uso`,
          s,
          Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined,
        );
      }
      if (s >= 500)
        throw new MetricoolError(
          'server',
          `Metricool ${path} respondió ${s}`,
          s,
        );
      throw new MetricoolError(
        'bad_response',
        `Metricool ${path} respondió ${s}`,
        s,
      );
    }
    try {
      return (await res.json()) as T;
    } catch {
      throw new MetricoolError(
        'bad_response',
        `Metricool ${path}: respuesta no es JSON`,
      );
    }
  }

  /** Marcas accesibles con el token (valida credenciales sin leer contenido). */
  async listBrands(): Promise<MetricoolBrand[]> {
    const r = await this.get<unknown>(
      '/admin/simpleProfiles',
      {},
      { requireBrand: false },
    );
    if (!Array.isArray(r))
      throw new MetricoolError(
        'bad_response',
        'Metricool /admin/simpleProfiles: formato inesperado',
      );
    return r.map((b) => mapBrand(b as Record<string, unknown>));
  }

  async checkAuthorizations(
    platforms: Platform[],
  ): Promise<AuthorizationCheck[]> {
    const out: AuthorizationCheck[] = [];
    for (const p of platforms) {
      const provider = MC_PROVIDER[p];
      if (!provider) {
        out.push({
          platform: p,
          dataKind: 'comments',
          granted: false,
          detail: 'Red no soportada por Metricool',
        });
        continue;
      }
      try {
        const r = await this.get<{
          data?: { missingScopes?: string[]; authorized?: boolean };
        }>('/v2/inbox/post-comments/authorizations', { provider });
        const missing = r?.data?.missingScopes ?? [];
        const granted = missing.length === 0 && r?.data?.authorized !== false;
        out.push({
          platform: p,
          dataKind: 'comments',
          granted,
          detail: granted
            ? 'Autorizado'
            : missing.length
              ? `Faltan permisos en la red: ${missing.join(', ')}`
              : 'Faltan permisos en la red',
        });
      } catch (e) {
        if (e instanceof MetricoolError && e.kind === 'auth') throw e;
        out.push({
          platform: p,
          dataKind: 'comments',
          granted: false,
          detail: (e as Error).message,
        });
      }
    }
    return out;
  }

  /**
   * Publicaciones con métricas de la ventana. Instagram incluye reels. Pagina con `page.next`;
   * devuelve `nextCursor` si quedó trabajo por el límite.
   */
  async fetchPosts(
    platform: Platform,
    w: FetchWindow,
  ): Promise<FetchPage<NormalizedPost>> {
    const network = MC_PROVIDER[platform];
    if (!network || !POSTS_SUPPORTED.includes(platform))
      return { items: [], nextCursor: null };
    const paths = [`/v2/analytics/posts/${network}`];
    if (platform === 'instagram') paths.push('/v2/analytics/reels/instagram');
    const q = {
      from: w.from.toISOString().slice(0, 19),
      to: w.to.toISOString().slice(0, 19),
      timezone: w.timezone,
    };
    const items: NormalizedPost[] = [];
    for (const path of paths) {
      let next: string | null = null;
      let pages = 0;
      do {
        const r: McListResponse<Record<string, unknown>> = await this.get(
          path,
          next ? { ...q, next } : q,
        );
        for (const p of r.data ?? [])
          items.push(mapMetricoolPost(platform, p, path.includes('/reels/')));
        next = r.page?.next ?? null;
        pages++;
      } while (next && items.length < w.limit && pages < 20);
    }
    return {
      items: items.filter((p) => p.externalId).slice(0, w.limit),
      nextCursor: null,
    };
  }

  async fetchComments(
    platform: Platform,
    w: FetchWindow,
  ): Promise<FetchPage<NormalizedComment>> {
    const r = await this.fetchThreads(platform, w.cursor ?? null);
    const items = flattenThreads(platform, r.threads)
      .filter((c) => {
        const t = Date.parse(c.publishedAt);
        return t >= w.from.getTime() && t <= w.to.getTime();
      })
      .slice(0, w.limit);
    return { items, nextCursor: r.next };
  }

  /** Hilos crudos (para completar medios de publicaciones desde `element.mediaUrls`). */
  async fetchThreads(
    platform: Platform,
    cursor: string | null,
  ): Promise<{ threads: McThread[]; next: string | null }> {
    const provider = MC_PROVIDER[platform];
    if (!provider) return { threads: [], next: null };
    const q: Record<string, string> = { provider };
    if (cursor) q.next = cursor;
    const r = await this.get<McListResponse<McThread>>(
      '/v2/inbox/post-comments',
      q,
    );
    return { threads: r.data ?? [], next: r.page?.next ?? null };
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0
    ? v
    : v != null && typeof v !== 'object'
      ? String(v)
      : null;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function https(v: unknown): string | null {
  const s = str(v);
  return s && /^https:\/\//.test(s) ? s : null;
}
function dateOf(v: unknown): string | null {
  if (v && typeof v === 'object' && 'dateTime' in v)
    return str((v as { dateTime?: unknown }).dateTime);
  return str(v);
}

/** Tipo de contenido a partir del `type` de Metricool (valores no documentados). */
export function contentTypeOf(raw: unknown, isReel = false): ContentType {
  if (isReel) return 'reel';
  const t = (str(raw) ?? '').toLowerCase();
  if (/carousel|album/.test(t)) return 'carousel';
  if (/reel/.test(t)) return 'reel';
  if (/story/.test(t)) return 'story';
  if (/video/.test(t)) return 'video';
  if (/image|photo|picture/.test(t)) return 'image';
  if (/link/.test(t)) return 'link';
  if (/status|text/.test(t)) return 'text';
  return 'unknown';
}

export function mapMetricoolPost(
  platform: Platform,
  p: Record<string, unknown>,
  isReel = false,
): NormalizedPost {
  const contentType = contentTypeOf(p.type, isReel);
  const thumb = https(p.imageUrl) ?? https(p.picture);
  const isVideo = contentType === 'video' || contentType === 'reel';
  const media: NormalizedMedia[] = thumb
    ? [
        isVideo
          ? {
              // Metricool no entrega el archivo de video: solo la miniatura.
              kind: 'video',
              sourceUrl: thumb,
              previewUrl: thumb,
              durationSec: num(p.durationSeconds) ?? null,
            }
          : { kind: 'image', sourceUrl: thumb },
      ]
    : [];
  const reactionKeys = ['like', 'love', 'wow', 'haha', 'sorry', 'anger'];
  const reactions = Object.fromEntries(
    reactionKeys
      .map((k) => [k, num(p[k])] as const)
      .filter((e): e is readonly [string, number] => e[1] !== undefined),
  );
  const ownerDisplay = str(p.ownerDisplayName);
  const ownerHandle = str(p.ownerScreenName);
  return {
    externalId: str(p.postId) ?? str(p.reelId) ?? str(p.id) ?? '',
    platform,
    accountExternalId:
      str(p.businessId) ?? str(p.pageId) ?? str(p.userId) ?? null,
    body: str(p.content) ?? str(p.text),
    permalink: https(p.url) ?? https(p.link),
    publishedAt: dateOf(p.publishedAt) ?? dateOf(p.created),
    contentType,
    author:
      ownerDisplay || ownerHandle
        ? {
            display: ownerDisplay,
            handle: ownerHandle,
            avatarUrl: https(p.ownerPicture),
          }
        : null,
    media,
    mediaCountReported: null,
    metrics: applicableMetrics(
      {
        likes: num(p.likes) ?? num(p.reactions),
        comments: num(p.comments),
        shares: num(p.shares),
        views: num(p.views) ?? num(p.videoViewsTotal) ?? num(p.videoViews),
        // Alcance real solo si la red lo nombra así; impresiones únicas van aparte.
        reach: num(p.reach),
        impressions: num(p.impressionsTotal) ?? num(p.impressions),
        impressionsUnique: num(p.impressionsUnique),
        interactions: num(p.interactions),
        saves: num(p.saved),
        videoViews: num(p.videoViewsTotal) ?? num(p.videoViews),
        engagement: num(p.engagement),
        reactions: Object.keys(reactions).length ? reactions : undefined,
      },
      platform,
      contentType,
    ),
  };
}

export function mapBrand(b: Record<string, unknown>): MetricoolBrand {
  const has = (...keys: string[]) => keys.some((k) => str(b[k]));
  const networks: Platform[] = [];
  if (has('instagram')) networks.push('instagram');
  if (has('facebookPageId', 'facebook')) networks.push('facebook');
  if (has('linkedinCompany')) networks.push('linkedin');
  if (has('tiktok')) networks.push('tiktok');
  if (has('twitter')) networks.push('x');
  if (has('youtube')) networks.push('youtube');
  const tokenExpirations: Partial<Record<Platform, string>> = {};
  const tk = str(b.tiktokBusinessTokenExpiration);
  if (tk) tokenExpirations.tiktok = tk;
  const li = str(b.linkedInTokenExpiration);
  if (li) tokenExpirations.linkedin = li;
  // Metricool entrega el usuario de Instagram en `instagram` y el nombre de la página de
  // Facebook en `facebook` (el id de la página no es un nombre visible).
  const accounts: MetricoolBrand['accounts'] = {};
  const ig = str(b.instagram);
  if (ig) accounts.instagram = { handle: ig.replace(/^@/, ''), name: null };
  const fb = str(b.facebook);
  if (fb) accounts.facebook = { handle: null, name: fb };
  return {
    blogId: str(b.id) ?? '',
    label: str(b.label) ?? str(b.title) ?? 'Marca sin nombre',
    pictureUrl: https(b.picture),
    networks,
    tokenExpirations,
    accounts,
  };
}

/** Medios de cada publicación según los hilos de comentarios (`element.mediaUrls`). */
export function threadPostMedia(threads: McThread[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of threads) {
    const el = t.root?.element;
    if (!el?.id) continue;
    const urls = (el.mediaUrls ?? []).filter((u) => /^https:\/\//.test(u));
    if (urls.length) out.set(el.id, urls);
  }
  return out;
}

/** Aplana hilos (root + respuestas) a comentarios normalizados. */
export function flattenThreads(
  platform: Platform,
  threads: McThread[],
): NormalizedComment[] {
  const out: NormalizedComment[] = [];
  for (const t of threads) {
    const names = new Map(
      (t.participants ?? []).map((p) => [p.id, p.name ?? null]),
    );
    const root = t.root;
    if (!root) continue;
    const postId = root.element?.id ?? null;
    const link = root.element?.link ?? null;
    if (root.id && root.text) {
      out.push({
        externalId: root.id,
        parentExternalId: null,
        postExternalId: postId,
        platform,
        body: root.text,
        authorExternalId: root.owner ?? null,
        authorDisplay: (root.owner && names.get(root.owner)) ?? null,
        publishedAt: root.creationDate ?? new Date(0).toISOString(),
        permalink: link,
        mediaUrl: https(root.mediaUrl),
      });
    }
    for (const c of root.comments ?? []) {
      if (!c.id || !c.text) continue;
      out.push({
        externalId: c.id,
        parentExternalId: c.parentId ?? root.id ?? null,
        postExternalId: postId,
        platform,
        body: c.text,
        authorExternalId: c.owner ?? null,
        authorDisplay: (c.owner && names.get(c.owner)) ?? null,
        publishedAt:
          c.creationDate ?? root.creationDate ?? new Date(0).toISOString(),
        permalink: link,
        mediaUrl: https(c.mediaUrl),
      });
    }
  }
  return out;
}
