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
  return { connected: [...new Set(connected)], missing };
}
