/** Etiquetas puras (sin dependencias de servidor), seguras para componentes de cliente. */
export type MediaCoverage =
  | 'image_full'
  | 'carousel_cover'
  | 'video_thumbnail'
  | 'unavailable'
  | 'expired';

export const MEDIA_COVERAGE_LABEL: Record<MediaCoverage, string> = {
  image_full: 'Imagen completa analizada',
  carousel_cover: 'Portada de carrusel analizada',
  video_thumbnail: 'Miniatura de video analizada',
  unavailable: 'Imagen no disponible',
  expired: 'Imagen caducada',
};
