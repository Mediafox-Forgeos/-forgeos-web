/**
 * Reloj fijo SOLO para el servidor de QA (se carga con NODE_OPTIONS=--require desde
 * playwright.config.ts). No forma parte de heyfoxy-web ni de ningún build desplegable.
 *
 * Los datos demo se generan relativos a Date.now(); sin esto, las capturas cambiarían
 * cada día. El reloj arranca en HF_QA_FIXED_NOW y avanza en tiempo real (no se congela
 * para no romper temporizadores internos de Next.js).
 */
'use strict';

const RealDate = Date;
const START_REAL = RealDate.now();
const FIXED = RealDate.parse(
  process.env.HF_QA_FIXED_NOW || '2026-11-14T15:00:00.000Z',
);
if (Number.isNaN(FIXED)) throw new Error('HF_QA_FIXED_NOW inválido');

const now = () => FIXED + (RealDate.now() - START_REAL);

function QaDate(...args) {
  if (!new.target) return new RealDate(now()).toString();
  return args.length === 0 ? new RealDate(now()) : new RealDate(...args);
}
QaDate.prototype = RealDate.prototype;
Object.setPrototypeOf(QaDate, RealDate);
// Next copia los globales a otros contextos: los estáticos deben ser propiedades propias.
QaDate.parse = RealDate.parse;
QaDate.UTC = RealDate.UTC;
QaDate.now = now;

globalThis.Date = QaDate;
