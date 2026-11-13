// Guarda de build: verifica que el trazado de Next incluya su runtime.
// Evita repetir el fallo del Preview dpl_9vfWbpvhMz5xu8j3Zh4AX1UD2wJZ
// ("Cannot find module 'next/dist/compiled/source-map'").
import { readFileSync } from 'node:fs';

const REQUIRED = [
  'next/dist/compiled/source-map/',
  'next/dist/compiled/next-server/',
];
let failed = false;
// Mínimos holgados: con el fallo había 25 archivos; correcto ≈ 650 (server) y ≈ 100 (minimal).
const TRACES = {
  '.next/next-server.js.nft.json': 200,
  '.next/next-minimal-server.js.nft.json': 50,
};
for (const [file, minFiles] of Object.entries(TRACES)) {
  const { files } = JSON.parse(readFileSync(file, 'utf8'));
  const missing = REQUIRED.filter(
    (needle) => !files.some((f) => f.includes(needle)),
  );
  if (files.length < minFiles || missing.length) {
    console.error(
      `check-trace: ${file} incompleto (${files.length} archivos; faltan: ${missing.join(', ') || 'ninguno'})`,
    );
    failed = true;
  } else {
    console.log(`check-trace: ${file} ok (${files.length} archivos)`);
  }
}
process.exit(failed ? 1 : 0);
