import { sanitizeUntrusted } from '../guard';

/**
 * Minimización de datos antes de cualquier proveedor externo (WO-HF-AI-ENGINE-001 §10).
 *
 * No es un filtro de palabras clave aislado; es la segunda de cuatro capas:
 *  1. Lista blanca estructural (context.ts): al prompt solo llegan campos enumerados
 *     (copy publicado, red, formato, fecha, métricas, Brand Brain autorizado). Comentarios,
 *     autores de comentarios, usuarios de Hey Foxy, credenciales y tokens NO existen en la
 *     entrada del modelo: no hay campo que los transporte.
 *  2. Redacción de patrones de datos personales y secretos en el texto libre que sí viaja.
 *  3. Detección de narrativas personales de salud (testimonios, diagnósticos en primera
 *     persona, «paciente» + nombre propio): con datos reales, el copy marcado NO se envía.
 *  4. Autorización por organización (config.dataClearance): sin GO, ningún dato real sale.
 */

export interface Redaction {
  text: string;
  removed: Record<
    'email' | 'phone' | 'id' | 'secret' | 'url_query' | 'mention',
    number
  >;
}

const RULES: Array<[keyof Redaction['removed'], RegExp, string]> = [
  // Secretos con prefijos conocidos o cadenas largas de alta entropía.
  [
    'secret',
    /\b(?:sk-[a-z]{2,4}-[A-Za-z0-9_-]{10,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|[A-Fa-f0-9]{32,}|[A-Za-z0-9+/]{40,}={0,2})/g,
    '[dato retirado]',
  ],
  [
    'email',
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    '[correo retirado]',
  ],
  // Consulta de URL (puede llevar tokens de sesión o datos de seguimiento).
  ['url_query', /(https?:\/\/[^\s?#]+)\?[^\s#]+/g, '$1'],
  // Teléfonos: 7+ dígitos con separadores opcionales y prefijo internacional.
  [
    'phone',
    /(?<![\w/])(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}(?![\w/])/g,
    '[teléfono retirado]',
  ],
  // Documentos de identidad / historias clínicas: secuencias de 6 a 12 dígitos aisladas.
  ['id', /(?<![\w.,/%$])\d{6,12}(?![\w.,/%])/g, '[número retirado]'],
];

/** Redacta datos personales y secretos. `allowHandles`: cuentas propias de la marca. */
export function redactText(
  input: string,
  allowHandles: string[] = [],
): Redaction {
  const removed: Redaction['removed'] = {
    email: 0,
    phone: 0,
    id: 0,
    secret: 0,
    url_query: 0,
    mention: 0,
  };
  let text = input;
  for (const [k, re, rep] of RULES)
    text = text.replace(re, (...m) => {
      removed[k]++;
      return rep.replace('$1', String(m[1] ?? ''));
    });
  const own = new Set(
    allowHandles.map((h) => h.replace(/^@/, '').toLowerCase()),
  );
  text = text.replace(/(^|[^\w])@([A-Za-z0-9._]{2,30})/g, (m, pre, h) => {
    if (own.has(String(h).toLowerCase())) return m;
    removed.mention++;
    return `${pre}[cuenta mencionada]`;
  });
  return { text, removed };
}

export interface Sensitivity {
  personalHealth: boolean;
  reasons: string[];
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Señales de relato personal de salud. Se combinan estructura (primera persona, nombre
 * propio, edad) y vocabulario clínico: una pieza educativa general («prevenir el cáncer»)
 * no se marca; un testimonio («a mi hijo le diagnosticaron…», «la paciente Ana, 45 años»)
 * sí.
 */
export function sensitivityOf(input: string): Sensitivity {
  const t = fold(input);
  const reasons: string[] = [];
  const clinical =
    /\b(diagnostic\w*|tratamiento|cirugia|operaron|quimio\w*|historia clinica|resultado[s]? de (?:mi|su)|examen(?:es)? de (?:mi|su)|sintoma\w*|enfermedad|cancer|vih|embaraz\w*)\b/;
  const firstPerson =
    /\b(me diagnosticaron|le diagnosticaron|mi (?:hijo|hija|mama|papa|esposo|esposa|abuel[oa])|yo (?:tuve|tengo|padezco|sufri)|mi (?:diagnostico|tratamiento|cirugia|enfermedad))\b/;
  const patientNamed =
    /\bpaciente[s]?\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(input) ||
    /\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+,\s*\d{1,3}\s*años\b/.test(input);
  const testimony = /\b(testimonio|mi historia|nuestra paciente|caso real)\b/;
  if (firstPerson.test(t) && clinical.test(t))
    reasons.push('Relato de salud en primera persona o de un familiar.');
  if (patientNamed) reasons.push('Paciente identificado por nombre o edad.');
  if (testimony.test(t) && clinical.test(t))
    reasons.push('Testimonio con información clínica.');
  return { personalHealth: reasons.length > 0, reasons };
}

/** Texto externo listo para el prompt: neutralizado (guard) + redactado + truncado. */
export function prepareUntrustedText(
  input: string | null | undefined,
  max: number,
  allowHandles: string[] = [],
): { text: string; redactions: number } {
  const clean = sanitizeUntrusted(input ?? '', max);
  const r = redactText(clean, allowHandles);
  return {
    text: r.text,
    redactions: Object.values(r.removed).reduce((a, b) => a + b, 0),
  };
}
