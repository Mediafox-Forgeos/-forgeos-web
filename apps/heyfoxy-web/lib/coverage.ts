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
