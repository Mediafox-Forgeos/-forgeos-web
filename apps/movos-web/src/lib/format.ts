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
