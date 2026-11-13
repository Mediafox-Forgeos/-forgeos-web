import type {
  Platform,
  Sentiment,
  Severity,
  CoverageStatus,
  ReviewStatus,
} from '@/lib/types';

const TZ = 'America/Bogota';
export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TZ,
  }).format(new Date(iso));
}
export function fmtRelative(iso: string, now = Date.now()): string {
  const m = Math.round((now - Date.parse(iso)) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  x: 'X',
  web: 'Web/prensa',
  other: 'Otra',
};
export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: 'Positivo',
  neutral: 'Neutral',
  negative: 'Negativo',
  mixed: 'Mixto',
};
export const SEVERITY_LABEL: Record<Severity, string> = {
  info: 'Informativa',
  attention: 'Atención',
  high: 'Alta',
  critical: 'Crítica',
};
export const COVERAGE_LABEL: Record<CoverageStatus, string> = {
  complete: 'Completa',
  partial: 'Parcial',
  unavailable: 'No conectada',
  not_permitted: 'Sin permisos',
  not_requested: 'Pendiente',
};
export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  not_required: 'No requiere',
  pending: 'Pendiente de revisión',
  confirmed: 'Confirmada',
  dismissed: 'Descartada',
  adjusted: 'Ajustada',
};
export const INTENT_LABEL: Record<string, string> = {
  complaint: 'Queja',
  question: 'Pregunta',
  praise: 'Elogio',
  purchase_intent: 'Intención de compra',
  crisis_signal: 'Señal de crisis',
  spam: 'Spam',
  other: 'Otra',
};
