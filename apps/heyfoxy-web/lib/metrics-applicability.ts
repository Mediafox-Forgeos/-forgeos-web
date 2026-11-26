import type { Platform } from '@/lib/types';

/**
 * Métricas que NO aplican a un tipo de contenido: la fuente entrega 0 (no «sin dato»), y mostrar
 * «0 reproducciones» en una foto sugeriría un dato que no existe. Se tratan como no disponibles.
 *  - Reproducciones de video: solo video y reel.
 *  - «Vistas» de Facebook: Metricool entrega 0 en publicaciones que no son video.
 * Instagram sí entrega «vistas» reales para imágenes y carruseles (métrica views de Meta).
 * Sin tipo de contenido conocido (datos sintéticos, filas anteriores a 0006) no se cambia nada.
 */
export function applicableMetrics<
  T extends { views?: number | null; videoViews?: number | null },
>(m: T, platform: Platform, contentType: string | null | undefined): T {
  if (!contentType || contentType === 'unknown') return m;
  const video = contentType === 'video' || contentType === 'reel';
  if (video) return m;
  return {
    ...m,
    videoViews: m.videoViews === undefined ? undefined : null,
    ...(platform === 'facebook'
      ? { views: m.views === undefined ? undefined : null }
      : {}),
  };
}
