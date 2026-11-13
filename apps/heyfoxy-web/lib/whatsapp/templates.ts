import type { Severity } from '@/lib/types';

/**
 * Plantillas de utilidad (categoría UTILITY) para envío 1:1 fuera de la
 * ventana de 24 h. Deben aprobarse en Meta antes de cualquier envío real.
 * Variables {{n}} según formato de WhatsApp Cloud API.
 */
export interface WaTemplate {
  name: string;
  category: 'UTILITY';
  language: 'es';
  body: string;
  variables: string[];
  buttons: string[];
}

export const WA_TEMPLATES: Record<string, WaTemplate> = {
  hf_alerta_critica: {
    name: 'hf_alerta_critica',
    category: 'UTILITY',
    language: 'es',
    body: 'Hey Foxy · Alerta crítica para {{1}}: {{2}}. Prioridad {{3}}/100. Revisa el detalle en el Command Center.',
    variables: ['marca', 'resumen', 'prioridad'],
    buttons: ['Ver detalle', 'Asumir incidente'],
  },
  hf_alerta_tema: {
    name: 'hf_alerta_tema',
    category: 'UTILITY',
    language: 'es',
    body: 'Hey Foxy · El tema "{{1}}" de {{2}} creció {{3}} frente a su línea base en las últimas horas.',
    variables: ['tema', 'marca', 'variacion'],
    buttons: ['Ver detalle'],
  },
  hf_oportunidad: {
    name: 'hf_oportunidad',
    category: 'UTILITY',
    language: 'es',
    body: 'Hey Foxy · Oportunidad detectada para {{1}}: {{2}}.',
    variables: ['marca', 'resumen'],
    buttons: ['Ver detalle'],
  },
  hf_resumen_diario: {
    name: 'hf_resumen_diario',
    category: 'UTILITY',
    language: 'es',
    body: 'Hey Foxy · Resumen {{1}} de {{2}}: {{3}} conversaciones, {{4}} alertas. Cobertura: {{5}}.',
    variables: ['fecha', 'marca', 'conversaciones', 'alertas', 'cobertura'],
    buttons: ['Abrir informe'],
  },
  hf_escalamiento: {
    name: 'hf_escalamiento',
    category: 'UTILITY',
    language: 'es',
    body: 'Hey Foxy · El incidente "{{1}}" sigue sin responsable tras {{2}} minutos. Severidad: {{3}}.',
    variables: ['incidente', 'minutos', 'severidad'],
    buttons: ['Asumir incidente'],
  },
};

export function renderTemplate(name: string, values: string[]): string {
  const t = WA_TEMPLATES[name];
  if (!t) throw new Error(`Plantilla desconocida: ${name}`);
  if (values.length !== t.variables.length) {
    throw new Error(
      `Plantilla ${name} requiere ${t.variables.length} variables`,
    );
  }
  return t.body.replace(/\{\{(\d+)\}\}/g, (_, i) =>
    values[Number(i) - 1]!.slice(0, 200),
  );
}

const ORDER: Severity[] = ['info', 'attention', 'high', 'critical'];
export function severityAtLeast(s: Severity, min: Severity): boolean {
  return ORDER.indexOf(s) >= ORDER.indexOf(min);
}
