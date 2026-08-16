import { issueSignedToken, presignUrl } from '@vercel/blob';
import { NextResponse } from 'next/server';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_MOVOS_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';
const VIEW_URL_TTL_MS = 5 * 60 * 1000;

/**
 * WO-ARGOS-049 — private-read authorization. `movos-evidence` is a private
 * Blob store: the durable storage path alone grants no access. Every read
 * request is re-authorized fresh, server-to-server against movos-api (never
 * trusting a client-supplied storagePath), then a signed URL is minted with
 * a 5-minute expiry using `issueSignedToken`/`presignUrl` — never cached,
 * never persisted, matching "private viewing/downloading must use
 * short-lived authorization." No Blob credential is copied to Railway;
 * BLOB_READ_WRITE_TOKEN/VERCEL_OIDC_TOKEN are read automatically from
 * process.env by @vercel/blob, populated by Vercel's own runtime because
 * this route lives inside the project the store is connected to.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
): Promise<NextResponse> {
  const { attachmentId } = await params;
  const { searchParams } = new URL(request.url);
  const workOrderId = searchParams.get('workOrderId');
  const surface = searchParams.get('surface');
  const authorization = request.headers.get('authorization');
  const organizationId = request.headers.get('x-organization-id');

  if (
    !workOrderId ||
    (surface !== 'my-work' && surface !== 'work-orders') ||
    !authorization
  ) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const apiRes = await fetch(
    `${API_BASE_URL}${API_PREFIX}/${surface}/${workOrderId}/attachments/${attachmentId}`,
    {
      headers: {
        Authorization: authorization,
        ...(organizationId ? { 'X-Organization-Id': organizationId } : {}),
      },
    },
  );
  if (!apiRes.ok) {
    return NextResponse.json(
      { error: 'No autorizado para ver esta evidencia.' },
      { status: apiRes.status === 404 ? 404 : 403 },
    );
  }
  const attachment = (await apiRes.json()) as { storagePath: string };

  const validUntil = Date.now() + VIEW_URL_TTL_MS;
  const signedToken = await issueSignedToken({
    pathname: attachment.storagePath,
    operations: ['get'],
    validUntil,
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    operation: 'get',
    pathname: attachment.storagePath,
    access: 'private',
  });

  return NextResponse.json({
    url: presignedUrl,
    expiresAt: new Date(validUntil).toISOString(),
  });
}
