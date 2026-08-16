import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { ATTACHMENT_ALLOWED_MIME_TYPES } from '@mediafox/shared-types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_MOVOS_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';

interface EvidenceUploadClientPayload {
  workOrderId: string;
  mimeType: string;
  fileSizeBytes: number;
  eventId?: string;
}

/**
 * WO-ARGOS-049 — the only place a Blob client upload token is minted.
 * Runs on movos-web (Vercel), which is the project Vercel's `movos-evidence`
 * Blob store is connected to — @vercel/blob reads BLOB_READ_WRITE_TOKEN /
 * VERCEL_OIDC_TOKEN from process.env automatically at Vercel's runtime,
 * never a value this codebase reads, copies, or stores. No Blob credential
 * of any kind is ever sent to or held by movos-api (Railway) — see
 * docs/product/WORK_ORDER_V1_FIELD_HARDENING_DESIGN.md's architecture note.
 *
 * Authorization is never decided here — every request is forwarded,
 * server-to-server, to movos-api's own MyWorkController, which re-runs the
 * exact same JwtAuthGuard/OrgContextGuard/ownership checks every other
 * technician-scoped write already goes through. This route trusts nothing
 * about the request except what movos-api's response confirms.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  const authorization = request.headers.get('authorization');
  const organizationId = request.headers.get('x-organization-id');

  try {
    if (!authorization) {
      throw new Error('No autenticado.');
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayloadRaw) => {
        const payload = clientPayloadRaw
          ? (JSON.parse(clientPayloadRaw) as EvidenceUploadClientPayload)
          : null;
        if (
          !payload?.workOrderId ||
          !payload.mimeType ||
          !payload.fileSizeBytes
        ) {
          throw new Error('Solicitud de carga incompleta.');
        }

        const authRes = await fetch(
          `${API_BASE_URL}${API_PREFIX}/my-work/${payload.workOrderId}/attachments/authorize-upload`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authorization,
              ...(organizationId
                ? { 'X-Organization-Id': organizationId }
                : {}),
            },
            body: JSON.stringify({
              mimeType: payload.mimeType,
              fileSizeBytes: payload.fileSizeBytes,
              ...(payload.eventId ? { eventId: payload.eventId } : {}),
            }),
          },
        );
        if (!authRes.ok) {
          throw new Error(
            'No autorizado para adjuntar evidencia a esta orden de trabajo.',
          );
        }

        return {
          allowedContentTypes: [...ATTACHMENT_ALLOWED_MIME_TYPES],
          // movos-api's authorize-upload call above already validated the
          // declared size against the real per-kind limit — this is a
          // coarse platform-level ceiling, not the actual enforcement.
          maximumSizeInBytes: 200 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error al autorizar la carga de evidencia.',
      },
      { status: 400 },
    );
  }
}
