import type { Post } from '@/lib/types';
import type { StoredPost } from './types';

/**
 * Publicación importada → modelo de la interfaz. Solo medios entregados por la fuente; un video
 * de Metricool nunca es reproducible (solo miniatura). Métricas sin rellenar: `null` si faltan.
 */
export function storedToPost(
  orgId: string,
  p: StoredPost,
  /** Nombre de la cuenta propia (marca) cuando la red no lo entrega por publicación. */
  ownAccount: string | null = null,
): Post {
  const m = p.metrics;
  return {
    id: `${p.platform}:${p.externalId}`,
    organizationId: orgId,
    platform: p.platform,
    accountHandle: p.author?.handle ?? ownAccount,
    body: p.body,
    permalink: p.permalink,
    publishedAt: p.publishedAt,
    isSynthetic: false,
    metrics: [
      {
        capturedAt: p.lastSeenAt,
        likes: m.likes ?? null,
        comments: m.comments ?? null,
        shares: m.shares ?? null,
        views: m.views ?? null,
        reach: m.reach ?? null,
        impressions: m.impressions ?? null,
        impressionsUnique: m.impressionsUnique ?? null,
        interactions: m.interactions ?? null,
        saves: m.saves ?? null,
        videoViews: m.videoViews ?? null,
        engagement: m.engagement ?? null,
        reactions: m.reactions ?? null,
      },
    ],
    media: (p.media ?? []).map((x) => ({
      kind: x.kind,
      url: x.sourceUrl,
      previewUrl: x.previewUrl ?? null,
      durationSec: x.durationSec ?? null,
      playable: x.kind === 'video' ? false : undefined,
    })),
    author: p.author
      ? {
          displayName: p.author.display,
          handle: p.author.handle,
          avatarUrl: p.author.avatarUrl,
        }
      : null,
  };
}
