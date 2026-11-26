/**
 * Caducidad de URLs firmadas de los CDN de Meta (Instagram/Facebook, vía Metricool): el
 * parámetro `oe` es la fecha de expiración en segundos Unix, en hexadecimal. Sirve para no
 * pedir una imagen ya caducada (la interfaz muestra «vista previa caducada» directamente) y
 * para medir la renovación de referencias en cada sincronización. Otras URLs: desconocida.
 */
export function mediaExpiresAt(url: string | null | undefined): Date | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)(fbcdn\.net|cdninstagram\.com)$/.test(u.hostname)) return null;
    const oe = u.searchParams.get('oe');
    if (!oe || !/^[0-9a-f]{6,12}$/i.test(oe)) return null;
    return new Date(parseInt(oe, 16) * 1000);
  } catch {
    return null;
  }
}

export type MediaUrlStatus = 'ok' | 'expired' | 'unknown';

export function mediaUrlStatus(
  url: string | null | undefined,
  now = Date.now(),
): MediaUrlStatus {
  const exp = mediaExpiresAt(url);
  if (!exp) return 'unknown';
  return exp.getTime() <= now ? 'expired' : 'ok';
}
