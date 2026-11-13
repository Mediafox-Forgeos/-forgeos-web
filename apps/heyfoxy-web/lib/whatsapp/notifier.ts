import { renderTemplate, severityAtLeast } from './templates';
import type { Severity } from '@/lib/types';

export type WaMode = 'simulate' | 'sandbox' | 'live';

export interface WaRecipient {
  id: string;
  displayName: string;
  phoneE164: string;
  minSeverity: Severity;
  optedInAt: string | null;
  optedOutAt: string | null;
  isActive: boolean;
}

export interface WaDispatch {
  recipientId: string;
  template: string;
  preview: string;
  status: 'simulated' | 'suppressed' | 'queued';
  reason: string;
  idempotencyKey: string;
}

/**
 * Despachador WhatsApp 1:1 (requisito G: sin grupos).
 * Gate 2: solo 'simulate' — no hay red. 'live' lanza error hasta aprobación.
 * Reglas: opt-in obligatorio, umbral por destinatario, alerta crítica solo
 * tras revisión humana confirmada, idempotencia por alerta+destinatario.
 */
export function planDispatch(args: {
  mode: WaMode;
  alertId: string;
  severity: Severity;
  reviewConfirmed: boolean;
  template: string;
  values: string[];
  recipients: WaRecipient[];
}): WaDispatch[] {
  if (args.mode === 'live') {
    throw new Error('Envíos reales de WhatsApp no autorizados en Gate 2');
  }
  const preview = renderTemplate(args.template, args.values);
  return args.recipients.map((r) => {
    const base = {
      recipientId: r.id,
      template: args.template,
      preview,
      idempotencyKey: `wa:${args.alertId}:${r.id}`,
    };
    if (!r.isActive || r.optedOutAt)
      return {
        ...base,
        status: 'suppressed',
        reason: 'Destinatario inactivo o dado de baja',
      };
    if (!r.optedInAt)
      return {
        ...base,
        status: 'suppressed',
        reason: 'Sin consentimiento (opt-in)',
      };
    if (!severityAtLeast(args.severity, r.minSeverity))
      return {
        ...base,
        status: 'suppressed',
        reason: 'Bajo el umbral del destinatario',
      };
    if (args.severity === 'critical' && !args.reviewConfirmed) {
      return {
        ...base,
        status: 'suppressed',
        reason: 'Crítica pendiente de revisión humana',
      };
    }
    return {
      ...base,
      status: args.mode === 'simulate' ? 'simulated' : 'queued',
      reason: 'Cumple reglas',
    };
  });
}
