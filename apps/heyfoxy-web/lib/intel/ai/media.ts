import type { Post } from '@/lib/types';

/**
 * Foxy Multimodal Intelligence — preparación de imágenes (WO-HF-AI-ENGINE-001 §6).
 *
 * 1. Cobertura honesta: qué se puede analizar de verdad. Un reel solo tiene su miniatura; de
 *    un carrusel Metricool entrega la portada; una URL firmada puede haber caducado.
 * 2. Descarga segura en memoria (nunca a Storage) con protección SSRF: solo HTTPS, solo
 *    dominios permitidos, sin IP literales ni credenciales en la URL, resolución DNS
 *    verificada contra rangos privados, redirecciones revalidadas, tipo MIME y firma binaria
 *    comprobados, tamaño máximo y tiempo máximo.
 *    Riesgo residual documentado: sin fijar la IP resuelta en la conexión (fetch nativo) queda
 *    una ventana de DNS rebinding; la lista cerrada de dominios (CDN de Meta) la hace
 *    impracticable.
 */
import { MEDIA_COVERAGE_LABEL, type MediaCoverage } from './labels';

export { MEDIA_COVERAGE_LABEL, type MediaCoverage };

export interface MediaPlan {
  coverage: MediaCoverage;
  url: string | null;
  /** Declaración para el usuario y para el modelo (qué se ve y qué NO). */
  statement: string;
  width: number | null;
  height: number | null;
}

const isVideoType = (t?: string | null) => !!t && /reel|video|story/i.test(t);

export function planMedia(post: Post): MediaPlan {
  const items = post.media ?? [];
  const first = items[0];
  if (!first)
    return {
      coverage: 'unavailable',
      url: null,
      statement:
        'La fuente no entregó imagen de esta publicación: el análisis visual no está disponible.',
      width: null,
      height: null,
    };
  const expired =
    first.expired === true ||
    (!!first.expiresAt && Date.parse(first.expiresAt) <= Date.now());
  if (expired)
    return {
      coverage: 'expired',
      url: null,
      statement:
        'La vista previa caducó: no se analiza la imagen hasta la próxima sincronización autorizada.',
      width: null,
      height: null,
    };
  const video = first.kind === 'video' || isVideoType(post.contentType);
  if (video) {
    const url = first.previewUrl ?? (first.kind === 'image' ? first.url : null);
    return url
      ? {
          coverage: 'video_thumbnail',
          url,
          statement:
            'Se analiza solo la miniatura del video, no el video completo (ni audio, ni movimiento, ni el resto de escenas).',
          width: first.width ?? null,
          height: first.height ?? null,
        }
      : {
          coverage: 'unavailable',
          url: null,
          statement: 'El video no tiene miniatura disponible.',
          width: null,
          height: null,
        };
  }
  const reported = post.mediaCountReported ?? items.length;
  const carousel =
    /carousel|carrusel|album/i.test(post.contentType ?? '') ||
    reported > 1 ||
    items.length > 1;
  if (carousel)
    return {
      coverage: 'carousel_cover',
      url: first.url,
      statement: `Se analiza solo la portada del carrusel${reported > 1 ? ` (1 de ${reported} piezas)` : ''}; el resto de piezas no está disponible.`,
      width: first.width ?? null,
      height: first.height ?? null,
    };
  return {
    coverage: 'image_full',
    url: first.url,
    statement: 'Imagen completa de la publicación.',
    width: first.width ?? null,
    height: first.height ?? null,
  };
}

// --- Descarga segura ----------------------------------------------------------------------

/** CDN de Meta, donde Metricool entrega los medios de Instagram y Facebook. */
export const DEFAULT_MEDIA_HOSTS = ['cdninstagram.com', 'fbcdn.net'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export class MediaRejected extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'MediaRejected';
  }
}

function ipv4Private(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return true;
  const [a, b] = p as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** true si la dirección es privada, local, reservada o no se puede clasificar. */
export function isPrivateAddress(ip: string): boolean {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) return ipv4Private(s);
  if (!s.includes(':')) return true;
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]!);
  return (
    s === '::' ||
    s === '::1' ||
    s.startsWith('fc') ||
    s.startsWith('fd') ||
    s.startsWith('fe8') ||
    s.startsWith('fe9') ||
    s.startsWith('fea') ||
    s.startsWith('feb') ||
    s.startsWith('ff') ||
    s.startsWith('::ffff:') ||
    s.startsWith('64:ff9b:') ||
    s.startsWith('2001:db8')
  );
}

export function validateMediaUrl(raw: string, allowedHosts: string[]): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new MediaRejected('url_invalida');
  }
  if (u.protocol !== 'https:') throw new MediaRejected('protocolo_no_https');
  if (u.username || u.password) throw new MediaRejected('credenciales_en_url');
  if (u.port && u.port !== '443')
    throw new MediaRejected('puerto_no_permitido');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.startsWith('[') ||
    host.includes(':') ||
    /^\d+$/.test(host) ||
    /^0x/i.test(host)
  )
    throw new MediaRejected('ip_literal');
  if (
    host === 'localhost' ||
    /\.(local|localhost|internal|lan|home|corp|invalid|test)$/.test(host)
  )
    throw new MediaRejected('host_local');
  const ok = allowedHosts.some(
    (d) => host === d.toLowerCase() || host.endsWith(`.${d.toLowerCase()}`),
  );
  if (!ok) throw new MediaRejected('dominio_no_permitido');
  return u;
}

function sniff(bytes: Uint8Array): string | null {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47)
    return 'image/png';
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38)
    return 'image/gif';
  if (
    b(0) === 0x52 &&
    b(1) === 0x49 &&
    b(2) === 0x46 &&
    b(3) === 0x46 &&
    b(8) === 0x57 &&
    b(9) === 0x45 &&
    b(10) === 0x42 &&
    b(11) === 0x50
  )
    return 'image/webp';
  return null;
}

export interface FetchedImage {
  mediaType: string;
  base64: string;
  bytes: number;
}

export interface SafeFetchOptions {
  allowedHosts?: string[];
  fetchImpl?: typeof fetch;
  /** Resolución DNS (inyectable en pruebas). Devuelve todas las direcciones del host. */
  resolve?: (host: string) => Promise<string[]>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
}

async function defaultResolve(host: string): Promise<string[]> {
  const dns = await import('node:dns');
  const r = await dns.promises.lookup(host, { all: true, verbatim: true });
  return r.map((x) => x.address);
}

/** Descarga una imagen permitida en memoria. Lanza MediaRejected con un código explícito. */
export async function fetchImageSafely(
  raw: string,
  opts: SafeFetchOptions = {},
): Promise<FetchedImage> {
  const hosts = opts.allowedHosts ?? DEFAULT_MEDIA_HOSTS;
  const doFetch = opts.fetchImpl ?? fetch;
  const resolve = opts.resolve ?? defaultResolve;
  const maxBytes = opts.maxBytes ?? MAX_IMAGE_BYTES;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8_000);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    let url = validateMediaUrl(raw, hosts);
    for (let hop = 0; ; hop++) {
      let addrs: string[];
      try {
        addrs = await resolve(url.hostname);
      } catch {
        throw new MediaRejected('dns_fallido');
      }
      if (!addrs.length || addrs.some(isPrivateAddress))
        throw new MediaRejected('direccion_privada');
      let res: Response;
      try {
        res = await doFetch(url.toString(), {
          redirect: 'manual',
          signal: ctrl.signal,
          headers: { accept: ALLOWED_MIME.join(',') },
        });
      } catch {
        throw new MediaRejected(ctrl.signal.aborted ? 'tiempo_agotado' : 'red');
      }
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc || hop >= (opts.maxRedirects ?? 2))
          throw new MediaRejected('redireccion_no_permitida');
        url = validateMediaUrl(new URL(loc, url).toString(), hosts);
        continue;
      }
      if (res.status === 403 || res.status === 410)
        throw new MediaRejected('caducada');
      if (!res.ok) throw new MediaRejected(`http_${res.status}`);
      const declared = (res.headers.get('content-type') ?? '')
        .split(';')[0]!
        .trim()
        .toLowerCase();
      if (!ALLOWED_MIME.includes(declared))
        throw new MediaRejected('tipo_no_permitido');
      const len = Number(res.headers.get('content-length'));
      if (Number.isFinite(len) && len > maxBytes)
        throw new MediaRejected('demasiado_grande');
      if (!res.body) throw new MediaRejected('sin_contenido');
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new MediaRejected('demasiado_grande');
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        bytes.set(c, off);
        off += c.byteLength;
      }
      const real = sniff(bytes);
      if (!real || real !== declared)
        throw new MediaRejected('firma_no_coincide');
      return {
        mediaType: real,
        base64: Buffer.from(bytes).toString('base64'),
        bytes: total,
      };
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
