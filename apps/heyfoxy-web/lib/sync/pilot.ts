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
  // WO-HF-METRICOOL-FIX-001: el control de información de salud es solo por vocabulario y no
  // hay un tratamiento autorizado para texto clínico libre: los comentarios NO se importan.
  // Reactivarlo requiere un control adicional aprobado y un GO explícito.
  importComments: false,
} as const satisfies Pick<
  SyncDeps,
  'maxPostsPerNetwork' | 'networks' | 'protectPersonalData' | 'importComments'
>;
