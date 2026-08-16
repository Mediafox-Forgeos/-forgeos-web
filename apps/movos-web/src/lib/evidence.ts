'use client';

import { upload } from '@vercel/blob/client';
import {
  attachmentKindForMimeType,
  type ApiWorkOrderAttachment,
} from '@mediafox/shared-types';

import { apiClient } from './api-client';
import { getAccessToken, getActiveOrganizationId } from './auth';

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

export interface UploadEvidenceOptions {
  workOrderId: string;
  eventId?: string;
  onProgress?: (percentage: number) => void;
}

/**
 * WO-ARGOS-049 — the only place `@vercel/blob/client`'s `upload()` is
 * called. The pathname is randomized (crypto.randomUUID(), never the
 * original filename) and the server independently adds another random
 * suffix on top (see /api/evidence/upload) — never guessable, never
 * derived from user input. Authorization is decided entirely server-side,
 * by movos-api, before a token is ever minted; this function trusts
 * nothing about its own inputs beyond what the server confirms.
 */
export async function uploadEvidence(
  file: File,
  options: UploadEvidenceOptions,
): Promise<ApiWorkOrderAttachment> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No autenticado.');
  }
  const orgId = getActiveOrganizationId();

  const kind = attachmentKindForMimeType(file.type);
  if (!kind) {
    throw new Error(
      `Tipo de archivo no permitido: ${file.type || 'desconocido'}.`,
    );
  }
  const ext = EXTENSION_BY_MIME_TYPE[file.type] ?? 'bin';
  const pathname = `workorders/${options.workOrderId}/${crypto.randomUUID()}.${ext}`;

  const blob = await upload(pathname, file, {
    access: 'private',
    handleUploadUrl: '/api/evidence/upload',
    clientPayload: JSON.stringify({
      workOrderId: options.workOrderId,
      eventId: options.eventId,
      mimeType: file.type,
      fileSizeBytes: file.size,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(orgId ? { 'X-Organization-Id': orgId } : {}),
    },
    ...(options.onProgress
      ? {
          onUploadProgress: (event: { percentage: number }) =>
            options.onProgress?.(event.percentage),
        }
      : {}),
  });

  return apiClient.post<ApiWorkOrderAttachment>(
    `/my-work/${options.workOrderId}/attachments`,
    {
      storagePath: blob.pathname,
      mimeType: file.type,
      fileSizeBytes: file.size,
      originalFilename: file.name,
      ...(options.eventId ? { eventId: options.eventId } : {}),
    },
  );
}

/**
 * Fetches a fresh, short-lived signed URL for one private attachment.
 * Never cache the result beyond immediate use — a new call always mints a
 * new URL, matching movos-web's own 5-minute-expiry design.
 */
export async function getEvidenceViewUrl(
  workOrderId: string,
  attachmentId: string,
  surface: 'my-work' | 'work-orders',
): Promise<string> {
  const token = getAccessToken();
  const orgId = getActiveOrganizationId();
  const params = new URLSearchParams({ workOrderId, surface });

  const res = await fetch(
    `/api/evidence/${attachmentId}/view-url?${params.toString()}`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(orgId ? { 'X-Organization-Id': orgId } : {}),
      },
    },
  );
  if (!res.ok) {
    throw new Error('No se pudo obtener la evidencia.');
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}
