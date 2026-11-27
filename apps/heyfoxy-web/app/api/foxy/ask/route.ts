import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentViewer, repository } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import { ORG_COOKIE } from '@/lib/auth/session';
import { askGenerative, type AskEvent } from '@/lib/intel/ai/ask';
import { engineDeps } from '@/lib/intel/ai/runtime';
import { loadFoxyScope } from '@/lib/intel/ai/scope';

export const dynamic = 'force-dynamic';

/**
 * Ask Foxy en streaming (WO-HF-AI-ENGINE-001 §7). Devuelve NDJSON: un evento por línea
 * (meta, draft, final, local, error). El contexto se reconstruye SIEMPRE en el servidor desde
 * la sesión y la organización activa (membresía real); el navegador solo envía la pregunta,
 * el alcance (publicación, red, periodo, filtros) y el resumen de la conversación ya mostrada.
 * Si el cliente cancela, la señal de la petición corta también la llamada al proveedor.
 */
const Body = z.object({
  question: z.string().trim().min(3).max(500),
  postId: z.string().trim().max(80).nullable().default(null),
  period: z.string().max(10).default('30d'),
  platform: z.string().max(20).nullable().default(null),
  scopeLabel: z.string().max(200).default('Marca'),
  filters: z.array(z.string().max(60)).max(8).default([]),
  history: z
    .array(z.object({ q: z.string().max(500), a: z.string().max(1_500) }))
    .max(8)
    .default([]),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return req.headers.get('sec-fetch-site') === 'same-origin';
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: 'Origen no permitido.' },
      { status: 403 },
    );
  const viewer = await currentViewer();
  if (!viewer)
    return NextResponse.json(
      { error: 'Inicia sesión de nuevo.' },
      { status: 401 },
    );
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'Solicitud no válida.' },
      { status: 400 },
    );
  }
  const repo = repository();
  const memberships = await repo.memberships(viewer);
  const wanted = (await cookies()).get(ORG_COOKIE)?.value;
  const active =
    memberships.find((m) => m.organization.id === wanted) ?? memberships[0];
  if (!active)
    return NextResponse.json({ error: 'Sin organización.' }, { status: 403 });
  const orgId = active.organization.id;
  const scope = await loadFoxyScope(repo, orgId, body);
  if ('error' in scope)
    return NextResponse.json({ error: scope.error }, { status: 404 });

  const deps = engineDeps();
  const enc = new TextEncoder();
  const ctrl = new AbortController();
  req.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  const events = askGenerative(deps, {
    orgId,
    userId: viewer.userId,
    question: body.question,
    scopeLabel: body.scopeLabel,
    post: scope.post,
    peers: scope.peers,
    brand: scope.brand,
    brandOrgId: scope.brandOrgId,
    learnings: scope.learnings,
    learningsOrgId: scope.learningsOrgId,
    periodLabel: scope.periodLabel,
    platformFilter: body.platform,
    filters: body.filters,
    history: body.history,
    requestId: `${viewer.userId.slice(0, 8)}-${body.requestId}`.slice(0, 80),
    signal: ctrl.signal,
  });
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) return controller.close();
        controller.enqueue(
          enc.encode(`${JSON.stringify(value satisfies AskEvent)}\n`),
        );
      } catch {
        controller.enqueue(
          enc.encode(
            `${JSON.stringify({ type: 'error', message: 'Foxy no pudo completar la respuesta.', code: 'provider_error' })}\n`,
          ),
        );
        controller.close();
      }
    },
    async cancel() {
      ctrl.abort();
      await events.return(undefined);
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
