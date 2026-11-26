import { PROVIDER_CATALOG } from '@/lib/connectors/registry';
import { PLATFORM_LABEL } from '@/lib/format';
import type { CoverageRow } from '@/lib/types';

const KIND: Record<string, string> = {
  comments: 'comentarios',
  mentions: 'menciones',
  posts: 'publicaciones',
  post_metrics: 'métricas',
  direct_messages: 'mensajes directos',
  reviews: 'reseñas',
};

/** Resume cobertura en frases para el aviso obligatorio (requisito D). */
export function summarizeCoverage(rows: CoverageRow[]) {
  const connected = rows
    .filter((r) => r.status === 'complete' || r.status === 'partial')
    .map(
      (r) =>
        `${KIND[r.dataKind]} de ${PLATFORM_LABEL[r.platform]}${r.provider === 'demo' ? ' (ficticio)' : ''}${r.status === 'partial' ? ' (parcial)' : ''}`,
    );
  // Un par red+tipo cuenta como escuchado si CUALQUIER fuente lo cubre.
  const covered = new Set(
    rows
      .filter((r) => r.status === 'complete' || r.status === 'partial')
      .map((r) => `${r.platform}:${r.dataKind}`),
  );
  const missing = [
    ...new Set(
      rows
        .filter((r) => !covered.has(`${r.platform}:${r.dataKind}`))
        .map((r) => `${KIND[r.dataKind]} de ${PLATFORM_LABEL[r.platform]}`),
    ),
  ];
  // Pares desactivados a propósito (política de privacidad): no son «sin escuchar».
  const disabled = [
    ...new Set(
      rows
        .filter(
          (r) =>
            r.status === 'not_requested' &&
            /privacidad/i.test(r.reason ?? '') &&
            !covered.has(`${r.platform}:${r.dataKind}`),
        )
        .map((r) => `${KIND[r.dataKind]} de ${PLATFORM_LABEL[r.platform]}`),
    ),
  ];
  const live = rows.filter(
    (r) => r.status === 'complete' || r.status === 'partial',
  );
  return {
    connected: [...new Set(connected)],
    missing: missing.filter((m) => !disabled.includes(m)),
    disabled,
    // Fuentes (proveedores), redes y tipos de dato se cuentan por separado (HF-UX-10).
    sources: [
      ...new Set(
        live.map((r) => PROVIDER_CATALOG[r.provider]?.label ?? r.provider),
      ),
    ],
    networks: [...new Set(live.map((r) => PLATFORM_LABEL[r.platform]))],
  };
}

/**
 * Estado de la conversación para el módulo reputacional (WO-HF-V2-UX-REFINEMENT-002 §2G).
 * Distingue: análisis desactivado por privacidad · fuente no conectada · sin comentarios
 * importados · sin conversaciones detectadas · disponible. Nunca confunde «no importado» con
 * «no hay conversación».
 */
export type ConversationCoverage =
  | 'available'
  | 'no_conversations'
  | 'not_imported'
  | 'not_connected'
  | 'privacy_disabled';

const CONV_KINDS = new Set([
  'comments',
  'mentions',
  'reviews',
  'direct_messages',
]);

export function conversationCoverage(
  rows: CoverageRow[],
  conversationsInPeriod: number,
): ConversationCoverage {
  if (conversationsInPeriod > 0) return 'available';
  const conv = rows.filter((r) => CONV_KINDS.has(r.dataKind));
  const live = conv.filter(
    (r) => r.status === 'complete' || r.status === 'partial',
  );
  if (!live.length) {
    if (
      conv.some(
        (r) =>
          r.status === 'not_requested' && /privacidad/i.test(r.reason ?? ''),
      )
    )
      return 'privacy_disabled';
    return conv.length ? 'not_imported' : 'not_connected';
  }
  return 'no_conversations';
}
