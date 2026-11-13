import { contentHash } from '@/lib/security/hash';
import type { NormalizedComment } from '@/lib/connectors/types';

/**
 * Pasos puros de ingesta: deduplicación (id externo + hash de contenido por
 * autor) y límite diario de items (requisito I). La persistencia la hace el
 * servidor con service role; aquí no hay red ni base.
 */
export interface IngestPlan {
  accepted: Array<NormalizedComment & { contentHash: string }>;
  duplicates: number;
  overLimit: number;
}

export function planIngestion(args: {
  incoming: NormalizedComment[];
  knownExternalIds: Set<string>;
  knownHashesByAuthor: Set<string>;
  itemsIngestedToday: number;
  maxItemsPerDay: number;
}): IngestPlan {
  const seenIds = new Set(args.knownExternalIds);
  const seenHashes = new Set(args.knownHashesByAuthor);
  let budget = Math.max(0, args.maxItemsPerDay - args.itemsIngestedToday);
  const accepted: IngestPlan['accepted'] = [];
  let duplicates = 0;
  let overLimit = 0;
  for (const c of args.incoming) {
    const h = contentHash(c.body);
    const authorKey = `${c.authorExternalId ?? 'anon'}:${h}`;
    if (seenIds.has(c.externalId) || seenHashes.has(authorKey)) {
      duplicates++;
      continue;
    }
    if (budget <= 0) {
      overLimit++;
      continue;
    }
    seenIds.add(c.externalId);
    seenHashes.add(authorKey);
    budget--;
    accepted.push({ ...c, contentHash: h });
  }
  return { accepted, duplicates, overLimit };
}

export function ingestionIdempotencyKey(
  dataSourceId: string,
  kind: string,
  from: Date,
  to: Date,
): string {
  return `${dataSourceId}:${kind}:${from.toISOString()}:${to.toISOString()}`;
}
