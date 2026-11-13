import type { ProviderId } from '@/lib/types';
import type { SourceConnector } from './types';

/**
 * Registro de conectores. Estado de cada proveedor en Gate 2:
 * metricool   -> contrato + cliente de solo lectura implementados; DESHABILITADO
 *                hasta entrega de credenciales y autorización MedPlus.
 * meta_graph, youtube_data, linkedin_cm, x_api, licensed_feed -> solo contrato.
 */
export const PROVIDER_CATALOG: Record<
  ProviderId,
  {
    label: string;
    stage: 'implemented_disabled' | 'contract_only' | 'demo';
    note: string;
  }
> = {
  metricool: {
    label: 'Metricool',
    stage: 'implemented_disabled',
    note: 'Plan Advanced activo. Requiere token API, userId/blogId y autorización escrita.',
  },
  meta_graph: {
    label: 'Meta Graph (FB/IG)',
    stage: 'contract_only',
    note: 'Requiere app Meta, verificación y App Review.',
  },
  youtube_data: {
    label: 'YouTube Data API',
    stage: 'contract_only',
    note: 'Comentarios públicos; cuota 10k unidades/día.',
  },
  linkedin_cm: {
    label: 'LinkedIn Community Mgmt',
    stage: 'contract_only',
    note: 'Aprobación discrecional de LinkedIn.',
  },
  x_api: {
    label: 'X API',
    stage: 'contract_only',
    note: 'Pago por uso; requiere aprobación de gasto.',
  },
  licensed_feed: {
    label: 'Proveedor licenciado',
    stage: 'contract_only',
    note: 'Fase 2; revisión legal.',
  },
  demo: {
    label: 'Demostración',
    stage: 'demo',
    note: 'Datos ficticios identificados.',
  },
};

export function assertConnectorUsable(c: SourceConnector): void {
  if (!c.isEnabled()) throw new Error(`Conector ${c.provider} no habilitado`);
}
