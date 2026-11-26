import type { NormalizedComment } from '@/lib/connectors/types';

/**
 * Protección de datos personales en comentarios de terceros (piloto MedPlus, doc 20).
 *
 * Se aplica en el servidor ANTES de persistir: el texto original nunca llega a la base.
 *  - Correos, teléfonos, números de documento, tarjetas y números de historia clínica se
 *    sustituyen por una etiqueta («[correo]», «[teléfono]»…).
 *  - El nombre visible del autor no se guarda (solo el seudónimo HMAC por organización).
 *  - Las imágenes adjuntas a comentarios de terceros no se guardan.
 *  - Si el comentario contiene información clínica en texto libre, su texto no se guarda.
 * Los mensajes privados no se leen: el conector no tiene ningún endpoint de mensajes.
 */

interface Rule {
  label: string;
  re: RegExp;
}

// El orden importa: lo más específico primero.
const RULES: Rule[] = [
  { label: '[correo]', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  {
    // «historia clínica 12345», «HC: 12345», «HC #12345»
    label: '[historia clínica]',
    re: /\b(?:historia\s+cl[ií]nica|h\.?\s?c\.?)\s*(?:n[°ºo.]*|#|:)?\s*[A-Za-z]{0,3}[-\s]?\d[\d.\s-]{3,}\d/gi,
  },
  {
    // Documento con prefijo: CC, C.C., TI, CE, NIT, DNI, pasaporte, cédula
    label: '[documento]',
    re: /\b(?:c\.?\s?c\.?|t\.?\s?i\.?|c\.?\s?e\.?|nit|dni|pasaporte|c[ée]dula)\s*(?:n[°ºo.]*|#|:)?\s*[A-Za-z]{0,2}\d[\d.\s-]{4,}\d/gi,
  },
  // Tarjetas: 13–19 dígitos con separadores opcionales.
  { label: '[tarjeta]', re: /\b(?:\d[ -]?){12,18}\d\b/g },
  // Teléfonos: prefijo internacional opcional y 7+ dígitos con separadores.
  {
    label: '[teléfono]',
    re: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d(?:[\s.-]?\d){6,11}\b/g,
  },
];

export interface Redaction {
  text: string;
  count: number;
}

export function redactPersonalData(input: string): Redaction {
  let text = input;
  let count = 0;
  for (const { label, re } of RULES) {
    text = text.replace(re, () => {
      count++;
      return label;
    });
  }
  return { text, count };
}

/**
 * Información clínica en texto libre (diagnósticos, enfermedades, tratamientos, resultados,
 * medicamentos). No hay tratamiento autorizado para conservarla: si aparece, el texto del
 * comentario NO se guarda; queda solo el marcador y los metadatos (red, publicación, fecha,
 * seudónimo del autor) para contar el volumen. Preferimos retener de más a guardar de más.
 */
const HEALTH_PATTERNS: RegExp[] = [
  // Revelación de un diagnóstico o padecimiento
  /\b(me|le|nos|les)\s+(diagnostic|detect|encontr)\w*/,
  /\b(diagnostic|padezc|padec|sufro\s+de|sufre\s+de|convalec)\w*/,
  // Enfermedades y condiciones
  /\b(cancer|tumor\w*|leucemia|linfoma|metastasis|diabet\w*|vih|sida|hepatitis|tuberculosis|epilep\w*|hipertens\w*|infarto|acv|derrame\s+cerebral|alzheimer|parkinson|esclerosis|lupus|artritis|asma|epoc|insuficiencia\s+\w+|covid\w*|vph|papiloma|ets|its|sifilis|gonorrea|herpes)\b/,
  /\b(depresion|ansiedad|bipolar\w*|esquizofreni\w*|psiquiatr\w*|suicid\w*|autolesi\w*|adiccion\w*|trastorno\w*)\b/,
  /\b(embaraz\w*|aborto|perdida\s+gestacional|infertilidad|fertilidad|in\s+vitro)\b/,
  // Tratamientos, procedimientos y resultados
  /\b(quimioterapia|quimio|radioterapia|dialisis|trasplante|biopsia|cirugia|operaron|operad[oa]|hospitaliz\w*|uci)\b/,
  /\bresultados?\s+de(l|\s+la|\s+los|\s+las)?\s+(examen\w*|laboratorio|biopsia|prueba\w*|patologia|resonancia|tac|ecografia)/,
  /\b(formula\s+medica|receta\s+medica|medicament\w*|dosis|\d+\s?mg|insulina|antidepresiv\w*|antibiotic\w*)\b/,
  /\b(historia\s+clinica|incapacidad\s+medica|epicrisis)\b/,
];

const fold = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function containsHealthInformation(text: string): boolean {
  const t = fold(text);
  return HEALTH_PATTERNS.some((re) => re.test(t));
}

export const HEALTH_WITHHELD_PREFIX = '[Información de salud no conservada';

/** Comentario listo para persistir: texto enmascarado, sin nombre visible ni imagen adjunta. */
export function protectComment<T extends NormalizedComment>(
  c: T,
): { comment: T; redactions: number; healthWithheld: boolean } {
  if (containsHealthInformation(c.body)) {
    // Referencia corta al id de la red (no personal) para que dos comentarios retenidos del
    // mismo autor no se confundan como duplicados.
    return {
      comment: {
        ...c,
        body: `${HEALTH_WITHHELD_PREFIX} · #${c.externalId.slice(-6)}]`,
        authorDisplay: null,
        mediaUrl: null,
      },
      redactions: 0,
      healthWithheld: true,
    };
  }
  const r = redactPersonalData(c.body);
  return {
    comment: { ...c, body: r.text, authorDisplay: null, mediaUrl: null },
    redactions: r.count,
    healthWithheld: false,
  };
}
