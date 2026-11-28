import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_IMAGE_BYTES, MediaRejected, sniffImage } from './media';
import { parseSyntheticMediaPath } from './synthetic-media';

/**
 * Lee una imagen sintética propia del disco del despliegue (public/synthetic-media). Solo
 * rutas que pasan la expresión estricta de `parseSyntheticMediaPath` (carpeta y nombre
 * cerrados, sin `..`); comprueba la firma binaria y el tamaño. Nunca usa la red.
 */
export async function readSyntheticImage(
  mediaPath: string,
): Promise<{ mediaType: string; base64: string; bytes: number }> {
  const ref = parseSyntheticMediaPath(mediaPath);
  if (!ref) throw new MediaRejected('ruta_no_permitida');
  const file = path.join(
    process.cwd(),
    'public',
    'synthetic-media',
    ref.folder,
    `${ref.name}.${ref.ext}`,
  );
  let buf: Buffer;
  try {
    buf = await readFile(file);
  } catch {
    throw new MediaRejected('no_encontrada');
  }
  if (buf.byteLength > MAX_IMAGE_BYTES)
    throw new MediaRejected('demasiado_grande');
  const mediaType = sniffImage(new Uint8Array(buf));
  if (!mediaType) throw new MediaRejected('tipo_no_permitido');
  return { mediaType, base64: buf.toString('base64'), bytes: buf.byteLength };
}
