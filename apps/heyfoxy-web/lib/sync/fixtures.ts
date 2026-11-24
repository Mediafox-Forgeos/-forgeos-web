/**
 * Servidor Metricool SINTÉTICO para pruebas y para la simulación del modo demo.
 * Respuestas construidas desde el esquema oficial (doc 16), sin datos reales de nadie.
 * Las URLs de medios usan el dominio reservado `.invalid` (RFC 2606): nunca resuelven, así que
 * la interfaz muestra el estado «vista previa no disponible» en lugar de inventar imágenes.
 */
export interface FixtureScenario {
  /** Token aceptado; cualquier otro responde 401. */
  validToken?: string;
  /** Tras N llamadas correctas, el token «caduca» y responde 401. */
  expireAfterCalls?: number;
  /** Responde 429 (con Retry-After) en las primeras N llamadas. */
  rateLimitFirst?: number;
  /** Responde 429 siempre (límite persistente). */
  rateLimitAlways?: boolean;
  /** Falla la red en las rutas que coincidan. */
  networkErrorOn?: RegExp;
  /** Redes con permisos de comentarios; el resto informa missingScopes. */
  commentScopes?: string[];
  /** Comentarios adicionales (para probar sincronización incremental). */
  extraComments?: Array<{
    provider: string;
    postId: string;
    id: string;
    text: string;
    at: string;
    owner?: string;
  }>;
}

export const FIXTURE_TOKEN = 'fixture-token-not-a-secret';
export const FIXTURE_USER = '900001';
export const FIXTURE_BLOG = '700001';

const M = (name: string) => `https://media.metricool-fixture.invalid/${name}`;

export function fixtureBrands() {
  return [
    {
      id: Number(FIXTURE_BLOG),
      userId: Number(FIXTURE_USER),
      label: 'Marca sintética QA',
      picture: M('brand.jpg'),
      instagram: 'marca_sintetica',
      facebookPageId: '100000001',
      facebook: 'Marca Sintética',
      linkedinCompany: 'urn:li:organization:1',
      tiktok: 'marcasintetica',
      linkedInTokenExpiration: '2027-01-31T00:00:00Z',
    },
    {
      id: 700002,
      userId: Number(FIXTURE_USER),
      label: 'Otra marca sintética',
      instagram: 'otra_sintetica',
    },
  ];
}

export function fixtureInstagramPosts() {
  return [
    {
      postId: 'ig-img-1',
      type: 'IMAGE',
      publishedAt: {
        dateTime: '2026-11-20T15:00:00',
        timezone: 'America/Bogota',
      },
      url: 'https://www.instagram.com/p/fixture1/',
      content: '[SINTÉTICO] Publicación con una imagen',
      imageUrl: M('ig-img-1.jpg'),
      likes: 120,
      comments: 14,
      shares: 3,
      interactions: 140,
      engagement: 3.1,
      reach: 4200,
      saved: 9,
      impressions: 5100,
      impressionsTotal: 5200,
      views: 0,
      businessId: '17841400000000001',
    },
    {
      postId: 'ig-car-2',
      type: 'CAROUSEL_ALBUM',
      publishedAt: {
        dateTime: '2026-11-21T10:00:00',
        timezone: 'America/Bogota',
      },
      url: 'https://www.instagram.com/p/fixture2/',
      content: '[SINTÉTICO] Carrusel (la analítica solo trae la portada)',
      imageUrl: M('ig-car-2-0.jpg'),
      likes: 300,
      comments: 40,
      shares: 12,
      interactions: 360,
      reach: 9800,
      saved: 31,
      impressionsTotal: 12000,
      businessId: '17841400000000001',
    },
    {
      postId: 'ig-txt-3',
      type: 'TEXT',
      publishedAt: {
        dateTime: '2026-11-22T09:00:00',
        timezone: 'America/Bogota',
      },
      url: 'https://www.instagram.com/p/fixture3/',
      content: '[SINTÉTICO] Publicación sin imagen',
      likes: 10,
      comments: 1,
      reach: 600,
      businessId: '17841400000000001',
    },
  ];
}

export function fixtureInstagramReels() {
  return [
    {
      reelId: 'ig-reel-4',
      type: 'REELS',
      publishedAt: {
        dateTime: '2026-11-22T18:00:00',
        timezone: 'America/Bogota',
      },
      url: 'https://www.instagram.com/reel/fixture4/',
      content: '[SINTÉTICO] Reel con miniatura',
      imageUrl: M('ig-reel-4-thumb.jpg'),
      durationSeconds: 42,
      likes: 800,
      comments: 55,
      shares: 70,
      views: 25000,
      videoViewsTotal: 25000,
      reach: 18000,
      saved: 40,
      businessId: '17841400000000001',
    },
  ];
}

export function fixtureFacebookPosts() {
  return [
    {
      postId: 'fb-5',
      type: 'photo',
      created: { dateTime: '2026-11-19T12:00:00', timezone: 'America/Bogota' },
      link: 'https://www.facebook.com/100000001/posts/5',
      text: '[SINTÉTICO] Publicación de Facebook con foto',
      picture: M('fb-5.jpg'),
      reactions: 210,
      like: 180,
      love: 25,
      wow: 5,
      comments: 20,
      shares: 15,
      impressions: 7000,
      impressionsUnique: 5400,
      clicks: 120,
      engagement: 4.2,
      ownerDisplayName: 'Marca Sintética',
      ownerScreenName: 'marcasintetica',
      ownerPicture: M('fb-owner.jpg'),
      pageId: '100000001',
    },
  ];
}

function threads(provider: string) {
  if (provider === 'instagram')
    return [
      {
        id: 'th-ig-1',
        provider,
        participants: [
          { id: 'u1', name: 'usuario_sintetico_1' },
          { id: 'u2', name: 'usuario_sintetico_2' },
        ],
        root: {
          id: 'c-ig-1',
          owner: 'u1',
          text: '[SINTÉTICO] ¿Cuándo abren las citas?',
          creationDate: '2026-11-20T16:00:00Z',
          element: {
            id: 'ig-img-1',
            link: 'https://www.instagram.com/p/fixture1/',
            mediaUrls: [M('ig-img-1.jpg')],
            commentCount: 14,
          },
          comments: [
            {
              id: 'c-ig-2',
              parentId: 'c-ig-1',
              owner: 'u2',
              text: '[SINTÉTICO] Respuesta: yo también quiero saber',
              creationDate: '2026-11-20T17:00:00Z',
            },
            // Duplicado exacto (mismo id) y duplicado por contenido (mismo autor y texto, otro id).
            {
              id: 'c-ig-2',
              parentId: 'c-ig-1',
              owner: 'u2',
              text: '[SINTÉTICO] Respuesta: yo también quiero saber',
              creationDate: '2026-11-20T17:00:00Z',
            },
            {
              id: 'c-ig-2-bis',
              parentId: 'c-ig-1',
              owner: 'u2',
              text: '[SINTÉTICO] Respuesta: yo también quiero saber!',
              creationDate: '2026-11-20T17:05:00Z',
            },
          ],
        },
      },
      {
        id: 'th-ig-2',
        provider,
        participants: [{ id: 'u3', name: 'usuario_sintetico_3' }],
        root: {
          id: 'c-ig-3',
          owner: 'u3',
          text: '[SINTÉTICO] La app no carga desde ayer',
          creationDate: '2026-11-21T12:00:00Z',
          // El hilo trae 2 de los medios del carrusel (carrusel parcial).
          element: {
            id: 'ig-car-2',
            link: 'https://www.instagram.com/p/fixture2/',
            mediaUrls: [M('ig-car-2-0.jpg'), M('ig-car-2-1.jpg')],
            commentCount: 40,
          },
          comments: [],
        },
      },
    ];
  if (provider === 'facebook')
    return [
      {
        id: 'th-fb-1',
        provider,
        participants: [{ id: 'f1', name: 'usuario_sintetico_fb' }],
        root: {
          id: 'c-fb-1',
          owner: 'f1',
          text: '[SINTÉTICO] Excelente atención',
          creationDate: '2026-11-19T14:00:00Z',
          element: {
            id: 'fb-5',
            link: 'https://www.facebook.com/100000001/posts/5',
            mediaUrls: [M('fb-5.jpg')],
          },
          comments: [],
        },
      },
    ];
  return [];
}

/** `fetch` sintético con escenarios. Registra las llamadas para las aserciones. */
export function fixtureFetch(s: FixtureScenario = {}) {
  const calls: Array<{
    path: string;
    method: string;
    query: Record<string, string>;
  }> = [];
  let ok = 0;
  let limited = 0;
  const valid = s.validToken ?? FIXTURE_TOKEN;
  const scopes = s.commentScopes ?? ['instagram', 'facebook'];
  const impl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api/, '');
    calls.push({
      path,
      method: init?.method ?? 'GET',
      query: Object.fromEntries(url.searchParams),
    });
    if (s.networkErrorOn?.test(path)) throw new TypeError('fetch failed');
    if (s.rateLimitAlways || (s.rateLimitFirst && limited < s.rateLimitFirst)) {
      limited++;
      return new Response('{"error":"too many requests"}', {
        status: 429,
        headers: { 'retry-after': '1' },
      });
    }
    const token = (init?.headers as Record<string, string> | undefined)?.[
      'X-Mc-Auth'
    ];
    if (
      token !== valid ||
      (s.expireAfterCalls !== undefined && ok >= s.expireAfterCalls)
    )
      return new Response('{"error":"unauthorized"}', { status: 401 });
    ok++;
    const list = (data: unknown[]) =>
      Response.json({ data, page: { next: null } });
    if (path === '/admin/simpleProfiles') return Response.json(fixtureBrands());
    if (path === '/v2/inbox/post-comments/authorizations') {
      const p = url.searchParams.get('provider') ?? '';
      return Response.json({
        data: {
          missingScopes: scopes.includes(p) ? [] : ['pages_read_user_content'],
          allowAccessToMessages: false,
        },
      });
    }
    if (path === '/v2/analytics/posts/instagram')
      return list(fixtureInstagramPosts());
    if (path === '/v2/analytics/reels/instagram')
      return list(fixtureInstagramReels());
    if (path === '/v2/analytics/posts/facebook')
      return list(fixtureFacebookPosts());
    if (path === '/v2/inbox/post-comments') {
      const p = url.searchParams.get('provider') ?? '';
      const extra = (s.extraComments ?? [])
        .filter((c) => c.provider === p)
        .map((c) => ({
          id: `th-${c.id}`,
          provider: p,
          participants: [
            { id: c.owner ?? 'ux', name: 'usuario_sintetico_nuevo' },
          ],
          root: {
            id: c.id,
            owner: c.owner ?? 'ux',
            text: c.text,
            creationDate: c.at,
            element: { id: c.postId },
            comments: [],
          },
        }));
      return list([...threads(p), ...extra]);
    }
    return new Response('{"error":"not found"}', { status: 404 });
  }) as typeof fetch;
  return { impl, calls };
}
