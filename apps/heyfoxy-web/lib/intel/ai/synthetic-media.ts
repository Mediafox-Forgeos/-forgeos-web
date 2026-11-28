/**
 * Imágenes publicitarias SINTÉTICAS propias de las organizaciones de prueba (HF-QA-08, opción A).
 *
 * En la base, post_media guarda un identificador con el host reservado
 * `synthetic-media.heyfoxy.invalid` (TLD .invalid: nunca se resuelve ni se descarga). La
 * migración 0010 solo lo admite en organizaciones de demostración. Para mostrarlas, el
 * repositorio lo traduce a la ruta estática `/synthetic-media/<carpeta>/<archivo>` (archivos del
 * propio despliegue, protegido). Para analizarlas, el servidor las lee del disco
 * (`synthetic-media-server.ts`): sin red, sin Storage y sin tocar la descarga segura de la CDN
 * de Meta ni su lista de dominios.
 *
 * Módulo puro (sin Node): se usa también desde componentes y pruebas.
 */
export const SYNTHETIC_MEDIA_HOST = 'synthetic-media.heyfoxy.invalid';
export const SYNTHETIC_MEDIA_FOLDERS = ['aurora', 'horizonte'] as const;
export type SyntheticMediaFolder = (typeof SYNTHETIC_MEDIA_FOLDERS)[number];

const SOURCE_RE =
  /^https:\/\/synthetic-media\.heyfoxy\.invalid\/(aurora|horizonte)\/([a-z0-9][a-z0-9-]{0,59})\.(jpg|png)$/;
const PATH_RE =
  /^\/synthetic-media\/(aurora|horizonte)\/([a-z0-9][a-z0-9-]{0,59})\.(jpg|png)$/;

export interface SyntheticMediaRef {
  folder: SyntheticMediaFolder;
  name: string;
  ext: 'jpg' | 'png';
  path: string;
}

function ref(m: RegExpMatchArray | null): SyntheticMediaRef | null {
  if (!m) return null;
  const folder = m[1] as SyntheticMediaFolder;
  const name = m[2]!;
  const ext = m[3] as 'jpg' | 'png';
  return {
    folder,
    name,
    ext,
    path: `/synthetic-media/${folder}/${name}.${ext}`,
  };
}

/** Identificador de la base → ruta de visualización; cualquier otra URL se devuelve igual. */
export function displayMediaUrl(url: string): string;
export function displayMediaUrl(url: string | null): string | null;
export function displayMediaUrl(url: string | null): string | null {
  if (!url) return url;
  return ref(url.match(SOURCE_RE))?.path ?? url;
}

/** ¿Es una ruta de imagen sintética propia válida? (estricta: sin `..`, sin otros caracteres). */
export function parseSyntheticMediaPath(
  path: string,
): SyntheticMediaRef | null {
  return ref(path.match(PATH_RE));
}

export const isSyntheticMediaPath = (url: string | null | undefined) =>
  !!url && parseSyntheticMediaPath(url) !== null;
