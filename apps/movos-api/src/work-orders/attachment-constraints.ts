// WO-ARGOS-049 — deliberately duplicated from
// packages/shared-types/src/movos-api.ts rather than imported from there.
//
// @mediafox/shared-types ships as raw .ts source with no build step (its
// package.json `exports` point straight at ./src/index.ts) — every other
// file in movos-api only ever does `import type` from it, which tsc erases
// completely at compile time, so the package never needs to exist as a
// real runtime module inside movos-api's container. movos-web can import
// these same constants as real values because Next.js's bundler processes
// the .ts source directly at build time; movos-api's plain
// `node dist/main.js` at container start cannot — Node's native ESM
// loader fails to resolve the extensionless .ts import chain
// (@mediafox/shared-types/src/index.ts -> ./movos-api), which crash-looped
// production the one time this file used to import them directly instead.
//
// If these values ever need to change, update both this file and
// packages/shared-types/src/movos-api.ts's copy together.
import type { AttachmentKind } from '@mediafox/shared-types';

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export const ATTACHMENT_MAX_SIZE_BYTES: Record<AttachmentKind, number> = {
  IMAGE: 25 * 1024 * 1024, // 25 MB
  VIDEO: 200 * 1024 * 1024, // 200 MB
};

export function attachmentKindForMimeType(
  mimeType: string,
): AttachmentKind | null {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return null;
}
