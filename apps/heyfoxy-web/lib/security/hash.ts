import { createHash, createHmac } from 'node:crypto';

/** Hash estable del contenido normalizado para deduplicación semántica. */
export function contentHash(text: string): string {
  const normalized = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

/** Seudonimiza el identificador de autor por organización (minimización PII). */
export function authorHash(
  organizationId: string,
  platform: string,
  authorId: string,
  salt: string,
): string {
  return createHmac('sha256', salt)
    .update(`${organizationId}:${platform}:${authorId}`)
    .digest('hex')
    .slice(0, 32);
}
