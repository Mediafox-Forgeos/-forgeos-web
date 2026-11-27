import 'server-only';
import {
  brainAvailability,
  getBrandContext,
  listMemory,
} from '@/lib/brain/store';
import type { MemoryEntry, StoredBrandContext } from '@/lib/brain/types';
import type { Repository } from '@/lib/data/repository';
import { parsePeriod, periodDays, periodLabel } from '@/lib/period';
import type { Platform, Post } from '@/lib/types';

/**
 * Carga el alcance de una consulta a Foxy SIEMPRE en el servidor y SIEMPRE para la
 * organización activa de la sesión (WO §7, §8, §10): publicaciones del periodo (y red, si se
 * filtró), la publicación activa, el Brand Brain vigente con su versión y los aprendizajes.
 * El navegador solo envía identificadores y la pregunta; nunca datos ni la organización.
 */
export interface FoxyScopeData {
  post: Post | null;
  peers: Post[];
  brand: StoredBrandContext | null;
  brandOrgId: string | null;
  learnings: MemoryEntry[];
  learningsOrgId: string | null;
  periodLabel: string;
}

const PLATFORMS: Platform[] = [
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok',
  'x',
  'web',
  'other',
];

export async function loadFoxyScope(
  repo: Repository,
  orgId: string,
  input: { postId: string | null; period: string; platform?: string | null },
): Promise<FoxyScopeData | { error: string }> {
  const period = parsePeriod(input.period);
  const from = Date.now() - periodDays(period) * 86_400_000;
  const platform = PLATFORMS.includes(input.platform as Platform)
    ? (input.platform as Platform)
    : null;
  const [all, post, brand, learnings] = await Promise.all([
    repo.posts(orgId, { limit: 200 }),
    input.postId ? repo.post(orgId, input.postId) : Promise.resolve(null),
    getBrandContext(orgId),
    brainAvailability() === 'ready' ? listMemory(orgId) : Promise.resolve([]),
  ]);
  if (input.postId && !post)
    return { error: 'Publicación no encontrada en esta organización.' };
  const peers = all.filter(
    (p) =>
      p.organizationId === orgId &&
      (!p.publishedAt || Date.parse(p.publishedAt) >= from) &&
      (!platform || p.platform === platform),
  );
  return {
    post,
    peers,
    brand,
    brandOrgId: brand ? orgId : null,
    learnings,
    learningsOrgId: orgId,
    periodLabel: periodLabel(period),
  };
}
