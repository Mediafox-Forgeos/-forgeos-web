import { tenant } from '@/config/tenant';

export function formatCurrency(
  amount: number,
  currency: string = tenant.currency,
  locale: string = tenant.locale,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(
  value: number,
  locale: string = tenant.locale,
): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDateTime(
  iso: string,
  locale: string = tenant.locale,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

// WO-ARGOS-049 — WorkOrder.scheduledAt and the timeline summary are stored
// UTC and displayed in a single fixed timezone (America/Bogota, matching
// this pilot's real users) rather than the browser's own timezone — a
// deliberate V1 simplification since Site has no per-location timezone
// field yet. Revisit if MOVOS ever operates outside Colombia.
export function formatWorkOrderDateTime(
  iso: string,
  locale: string = tenant.locale,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}

export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
    ),
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// WO-ARGOS-051 — Operations Console "Today's scheduled work." Mirrors
// WorkOrderService's bogotaTodayRange (apps/movos-api/src/work-orders/
// work-order.service.ts) — same fixed America/Bogota UTC-5 convention (no
// DST) formatWorkOrderDateTime above already uses. Returns the
// [scheduledFrom, scheduledTo) query string GET /work-orders expects.
export function bogotaTodayRangeQuery(): string {
  const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
  const nowBogota = new Date(Date.now() - BOGOTA_OFFSET_MS);
  const year = nowBogota.getUTCFullYear();
  const month = nowBogota.getUTCMonth();
  const day = nowBogota.getUTCDate();
  const start = new Date(Date.UTC(year, month, day) + BOGOTA_OFFSET_MS);
  const end = new Date(Date.UTC(year, month, day + 1) + BOGOTA_OFFSET_MS);
  return `scheduledFrom=${encodeURIComponent(start.toISOString())}&scheduledTo=${encodeURIComponent(end.toISOString())}`;
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMinutes = Math.round((now - then) / 60000);
  if (diffMinutes < 1) return 'hace instantes';
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}
