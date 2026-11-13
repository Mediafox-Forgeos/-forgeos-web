import { describe, expect, it, vi } from 'vitest';
import {
  MetricoolConnector,
  flattenThreads,
  isAllowedMetricoolPath,
} from '@/lib/connectors/metricool';
import { ConnectorDisabledError } from '@/lib/connectors/types';

const win = {
  from: new Date('2026-11-01T00:00:00Z'),
  to: new Date('2026-11-13T00:00:00Z'),
  timezone: 'America/Bogota',
  limit: 100,
};

describe('Metricool: lista blanca de solo lectura', () => {
  it.each([
    '/v2/inbox/post-comments',
    '/v2/inbox/post-comments/authorizations',
    '/v2/analytics/posts/instagram',
    '/admin/simpleProfiles',
  ])('permite %s', (p) => expect(isAllowedMetricoolPath(p)).toBe(true));
  it.each([
    '/stats/deletecomment/facebook',
    '/stats/facebook/boost/123',
    '/stats/twitter/follow',
    '/admin/delete-profile',
    '/stats/postmessage/facebook',
    '/v2/scheduler/posts',
    '/v2/inbox/post-comments/../../admin/delete-profile',
  ])('bloquea %s', (p) => expect(isAllowedMetricoolPath(p)).toBe(false));
});

describe('Metricool: habilitación', () => {
  it('deshabilitado sin flag o credenciales; no toca la red', async () => {
    const fetchImpl = vi.fn();
    const c = new MetricoolConnector({
      enabled: false,
      token: 't',
      userId: '1',
      blogId: '2',
      fetchImpl,
    });
    expect(c.isEnabled()).toBe(false);
    await expect(c.fetchComments('instagram', win)).rejects.toBeInstanceOf(
      ConnectorDisabledError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(
      new MetricoolConnector({
        enabled: true,
        token: null,
        userId: '1',
        blogId: '2',
      }).isEnabled(),
    ).toBe(false);
  });
  it('envía X-Mc-Auth, userId y blogId; usa solo GET', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ data: [], page: { next: null } }),
    );
    const c = new MetricoolConnector({
      enabled: true,
      token: 'secret-token',
      userId: '11',
      blogId: '22',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minIntervalMs: 0,
    });
    await c.fetchComments('instagram', win);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.pathname).toBe('/api/v2/inbox/post-comments');
    expect(url.searchParams.get('provider')).toBe('instagram');
    expect(url.searchParams.get('userId')).toBe('11');
    expect(url.searchParams.get('blogId')).toBe('22');
    expect(url.searchParams.has('X-Mc-Auth')).toBe(false);
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['X-Mc-Auth']).toBe(
      'secret-token',
    );
  });
  it('los errores no filtran el token', async () => {
    const fetchImpl = (async () =>
      new Response('nope', { status: 401 })) as typeof fetch;
    const c = new MetricoolConnector({
      enabled: true,
      token: 'super-secret',
      userId: '1',
      blogId: '2',
      fetchImpl,
      minIntervalMs: 0,
    });
    const err = await c.fetchComments('facebook', win).catch((e: Error) => e);
    expect(String(err)).toContain('401');
    expect(String(err)).not.toContain('super-secret');
  });
});

describe('Metricool: normalización de hilos', () => {
  it('aplana raíz + respuestas y filtra por ventana', async () => {
    const thread = {
      id: 't1',
      provider: 'instagram',
      participants: [
        { id: 'u1', name: 'Autor Uno' },
        { id: 'u2', name: 'Autor Dos' },
      ],
      root: {
        id: 'r1',
        owner: 'u1',
        text: 'raíz',
        creationDate: '2026-11-05T10:00:00Z',
        element: { id: 'p1', link: 'https://example.test/p1' },
        comments: [
          {
            id: 'c1',
            parentId: 'r1',
            owner: 'u2',
            text: 'respuesta',
            creationDate: '2026-11-05T11:00:00Z',
          },
          {
            id: 'c2',
            parentId: 'r1',
            owner: 'u2',
            text: 'vieja',
            creationDate: '2026-10-01T11:00:00Z',
          },
        ],
      },
    };
    const flat = flattenThreads('instagram', [thread]);
    expect(flat.map((c) => c.externalId)).toEqual(['r1', 'c1', 'c2']);
    expect(flat[1]).toMatchObject({
      parentExternalId: 'r1',
      postExternalId: 'p1',
      authorDisplay: 'Autor Dos',
    });
    const fetchImpl = (async () =>
      Response.json({
        data: [thread],
        page: { next: 'cur2' },
      })) as typeof fetch;
    const c = new MetricoolConnector({
      enabled: true,
      token: 't',
      userId: '1',
      blogId: '2',
      fetchImpl,
      minIntervalMs: 0,
    });
    const page = await c.fetchComments('instagram', win);
    expect(page.items.map((i) => i.externalId)).toEqual(['r1', 'c1']);
    expect(page.nextCursor).toBe('cur2');
  });
  it('declara capacidades sin prometer menciones de terceros', () => {
    const caps = new MetricoolConnector({
      enabled: false,
      token: null,
      userId: null,
      blogId: null,
    }).capabilities();
    expect(caps.find((c) => c.dataKind === 'mentions')?.maxCoverage).toBe(
      'unavailable',
    );
    expect(
      caps
        .filter((c) => c.ownership === 'public_reference')
        .every((c) => c.dataKind !== 'comments'),
    ).toBe(true);
  });
});
