import type { SyncDeps } from './engine';

/**
 * Límites del piloto real (MedPlus, doc 20): primera importación de 30 días, solo Instagram y
 * Facebook, como máximo 10 publicaciones por red (las más recientes) y comentarios solo de esas
 * publicaciones, con datos personales enmascarados. Subirlos requiere cambio de código y GO.
 */
export const PILOT_LIMITS = {
  maxPostsPerNetwork: 10,
  networks: ['instagram', 'facebook'],
  protectPersonalData: true,
} as const satisfies Pick<
  SyncDeps,
  'maxPostsPerNetwork' | 'networks' | 'protectPersonalData'
>;
