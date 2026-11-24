import { z } from 'zod';

/**
 * Filtros de Social Explorer (`q`, `platform`, `orden`). Se validan en un solo sitio y se
 * propagan al detalle para que «volver» conserve la selección (Fase A, punto 4).
 */
export const EXPLORER_PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok',
  'x',
  'web',
  'other',
] as const;

const Filters = z.object({
  q: z.string().trim().min(1).max(100).optional().catch(undefined),
  platform: z.enum(EXPLORER_PLATFORMS).optional().catch(undefined),
  orden: z.enum(['recientes', 'interacciones']).optional().catch(undefined),
});

export type ExplorerFilters = z.infer<typeof Filters>;

/** Lee los filtros válidos; lo inválido se descarta en lugar de fallar. */
export function parseExplorerFilters(
  sp: Record<string, string | undefined>,
): ExplorerFilters {
  const r = Filters.safeParse({
    q: sp.q || undefined,
    platform: sp.platform || undefined,
    orden: sp.orden || undefined,
  });
  return r.success ? r.data : {};
}

/** Cadena de consulta (sin «?») con los filtros activos, en orden estable. */
export function explorerQuery(f: ExplorerFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.platform) p.set('platform', f.platform);
  if (f.orden && f.orden !== 'recientes') p.set('orden', f.orden);
  return p.toString();
}
