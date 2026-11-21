/** Periodo de análisis compartido por las vistas V2 (`?periodo=`), conservado al navegar. */
export const PERIODS = { '7d': 7, '30d': 30, '90d': 90 } as const;
export type PeriodKey = keyof typeof PERIODS;
export const DEFAULT_PERIOD: PeriodKey = '7d';
export const PERIOD_PARAM = 'periodo';

export function parsePeriod(v: string | null | undefined): PeriodKey {
  return v && Object.hasOwn(PERIODS, v) ? (v as PeriodKey) : DEFAULT_PERIOD;
}

export const periodDays = (k: PeriodKey) => PERIODS[k];
export const periodLabel = (k: PeriodKey) => `Últimos ${PERIODS[k]} días`;

const DAY = 86_400_000;
const TZ = 'America/Bogota';
const short = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: TZ,
});
const year = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  timeZone: TZ,
});

/** «8 nov – 14 nov 2026» (sin puntos de abreviatura). */
export function periodRange(k: PeriodKey, now = Date.now()): string {
  const from = now - (PERIODS[k] - 1) * DAY;
  const f = (t: number) => {
    const parts = short.formatToParts(t);
    const day = parts.find((p) => p.type === 'day')?.value;
    const month = parts.find((p) => p.type === 'month')?.value.replace('.', '');
    return `${day} ${month}`;
  };
  return `${f(from)} – ${f(now)} ${year.format(now)}`;
}

/** Añade el periodo a un enlace interno si no es el de por defecto. */
export function withPeriod(href: string, k: PeriodKey): string {
  if (k === DEFAULT_PERIOD) return href;
  const [path, hash] = href.split('#');
  const sep = path!.includes('?') ? '&' : '?';
  return `${path}${sep}${PERIOD_PARAM}=${k}${hash ? `#${hash}` : ''}`;
}
