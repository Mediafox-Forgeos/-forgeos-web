import type { NormalizedComment } from '@/lib/connectors/types';

/**
 * Protección de datos personales en comentarios de terceros (piloto MedPlus, doc 20).
 *
 * Se aplica en el servidor ANTES de persistir: el texto original nunca llega a la base.
 *  - Correos, teléfonos, números de documento, tarjetas y números de historia clínica se
 *    sustituyen por una etiqueta («[correo]», «[teléfono]»…).
 *  - El nombre visible del autor no se guarda (solo el seudónimo HMAC por organización).
 *  - Las imágenes adjuntas a comentarios de terceros no se guardan.
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

/** Comentario listo para persistir: texto enmascarado, sin nombre visible ni imagen adjunta. */
export function protectComment<T extends NormalizedComment>(
  c: T,
): { comment: T; redactions: number } {
  const r = redactPersonalData(c.body);
  return {
    comment: { ...c, body: r.text, authorDisplay: null, mediaUrl: null },
    redactions: r.count,
  };
}
