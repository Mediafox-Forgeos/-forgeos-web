import type { Platform } from '@/lib/types';
import {
  ConnectorDisabledError,
  type AuthorizationCheck,
  type FetchPage,
  type FetchWindow,
  type NormalizedComment,
  type NormalizedPost,
  type ProviderCapability,
  type SourceConnector,
} from './types';

/**
 * Conector Metricool (plan Advanced). Verificado contra la especificación
 * OpenAPI oficial (https://app.metricool.com/api/swagger.json, v2.0.0,
 * consultada 2026-11-13).
 *
 * Seguridad:
 *  - SOLO lectura. Metricool expone acciones de escritura incluso vía GET
 *    (p.ej. /stats/deletecomment, /stats/facebook/boost = campaña PAGADA,
 *    /stats/twitter/follow, /admin/delete-profile). Por eso se usa una lista
 *    blanca cerrada de rutas; cualquier otra ruta se rechaza antes de la red.
 *  - El token (X-Mc-Auth) nunca sale del servidor ni se registra en logs.
 *  - Deshabilitado salvo HF_CONNECTOR_METRICOOL_ENABLED=true + credenciales.
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
const MC_PROVIDER: Partial<Record<Platform, string>> = {
  facebook: 'facebook',
  instagram: 'instagram',
  linkedin: 'linkedin',
  youtube: 'youtube',
  tiktok: 'tiktok',
  x: 'twitter',
};

export interface MetricoolConfig {
  enabled: boolean;
  token: string | null;
  userId: string | null;
  blogId: string | null;
  fetchImpl?: typeof fetch;
  /** Límite defensivo propio; Metricool no publica rate limits. */
  minIntervalMs?: number;
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

// Esquema de respuesta /v2/inbox/post-comments (JsonOkListResponsePostCommentsThread).
interface McParticipant {
  id?: string;
  name?: string;
}
interface McComment {
  id?: string;
  parentId?: string;
  creationDate?: string;
  owner?: string;
  text?: string;
}
interface McThread {
  id?: string;
  provider?: string;
  participants?: McParticipant[];
  root?: {
    id?: string;
    element?: { id?: string; link?: string; text?: string };
    creationDate?: string;
    owner?: string;
    text?: string;
    comments?: McComment[];
  };
}
interface McListResponse<T> {
  data?: T[];
  page?: { next?: string | null };
}

export class MetricoolConnector implements SourceConnector {
  readonly provider = 'metricool' as const;
  readonly displayName = 'Metricool (Advanced)';
  private lastCallAt = 0;

  constructor(private readonly cfg: MetricoolConfig) {}

  isEnabled(): boolean {
    return Boolean(
      this.cfg.enabled && this.cfg.token && this.cfg.userId && this.cfg.blogId,
    );
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
        maxCoverage: 'complete',
        ownership: 'owned',
        note,
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
        maxCoverage: 'complete',
        ownership: 'owned',
        note,
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
  ): Promise<T> {
    if (!this.isEnabled()) {
      throw new ConnectorDisabledError(
        'metricool',
        'falta habilitación o credenciales',
      );
    }
    if (!isAllowedMetricoolPath(path)) {
      throw new Error(`Ruta Metricool no permitida (solo lectura): ${path}`);
    }
    const wait =
      (this.cfg.minIntervalMs ?? 1000) - (Date.now() - this.lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCallAt = Date.now();

    const url = new URL(METRICOOL_BASE_URL + path);
    url.searchParams.set('userId', this.cfg.userId!);
    url.searchParams.set('blogId', this.cfg.blogId!);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

    const res = await (this.cfg.fetchImpl ?? fetch)(url, {
      method: 'GET',
      headers: { 'X-Mc-Auth': this.cfg.token!, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      // Nunca incluir headers ni URL completa (contiene ids) en el error.
      throw new Error(`Metricool ${path} respondió ${res.status}`);
    }
    return (await res.json()) as T;
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
        const r = await this.get<{ data?: unknown }>(
          '/v2/inbox/post-comments/authorizations',
          { provider },
        );
        const granted = Boolean(
          r &&
          (r as { data?: { authorized?: boolean } }).data?.authorized !== false,
        );
        out.push({
          platform: p,
          dataKind: 'comments',
          granted,
          detail: granted ? 'Autorizado' : 'Faltan permisos en la red',
        });
      } catch (e) {
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

  async fetchPosts(
    platform: Platform,
    w: FetchWindow,
  ): Promise<FetchPage<NormalizedPost>> {
    const network = MC_PROVIDER[platform];
    if (!network || platform === 'youtube')
      return { items: [], nextCursor: null };
    const r = await this.get<McListResponse<Record<string, unknown>>>(
      `/v2/analytics/posts/${network}`,
      {
        from: w.from.toISOString().slice(0, 19),
        to: w.to.toISOString().slice(0, 19),
        timezone: w.timezone,
      },
    );
    const items = (r.data ?? [])
      .slice(0, w.limit)
      .map((p) => mapMetricoolPost(platform, p));
    return { items, nextCursor: null };
  }

  async fetchComments(
    platform: Platform,
    w: FetchWindow,
  ): Promise<FetchPage<NormalizedComment>> {
    const provider = MC_PROVIDER[platform];
    if (!provider) return { items: [], nextCursor: null };
    const q: Record<string, string> = { provider };
    if (w.cursor) q.next = w.cursor;
    const r = await this.get<McListResponse<McThread>>(
      '/v2/inbox/post-comments',
      q,
    );
    const items = flattenThreads(platform, r.data ?? [])
      .filter((c) => {
        const t = Date.parse(c.publishedAt);
        return t >= w.from.getTime() && t <= w.to.getTime();
      })
      .slice(0, w.limit);
    return { items, nextCursor: r.page?.next ?? null };
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

export function mapMetricoolPost(
  platform: Platform,
  p: Record<string, unknown>,
): NormalizedPost {
  return {
    externalId: str(p.postId) ?? str(p.id) ?? str(p.url) ?? '',
    platform,
    accountExternalId: str(p.businessId) ?? null,
    body: str(p.text) ?? str(p.content),
    permalink: str(p.url) ?? str(p.link),
    publishedAt: str(p.created) ?? str(p.publishedAt),
    metrics: {
      likes: num(p.likes) ?? num(p.reactions),
      comments: num(p.comments),
      shares: num(p.shares),
      views: num(p.views) ?? num(p.impressions),
      reach: num(p.reach),
    },
  };
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
      });
    }
  }
  return out;
}
