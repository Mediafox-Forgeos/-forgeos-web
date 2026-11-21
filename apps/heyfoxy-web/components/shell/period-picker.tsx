'use client';

import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { cn } from '@/lib/cn';
import {
  DEFAULT_PERIOD,
  PERIODS,
  PERIOD_PARAM,
  parsePeriod,
  periodLabel,
  type PeriodKey,
} from '@/lib/period';

/** Selector de periodo: cambia `?periodo` en la vista actual conservando el resto de filtros. */
export function PeriodPicker({
  ranges,
}: {
  ranges: Record<PeriodKey, string>;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const current = parsePeriod(params.get(PERIOD_PARAM));
  const ref = useRef<HTMLDetailsElement>(null);
  const hrefFor = (k: PeriodKey) => {
    const p = new URLSearchParams(params.toString());
    if (k === DEFAULT_PERIOD) p.delete(PERIOD_PARAM);
    else p.set(PERIOD_PARAM, k);
    const qs = p.toString();
    return `${path}${qs ? `?${qs}` : ''}`;
  };
  return (
    <details ref={ref} className="group relative">
      <summary className="border-border bg-card hover:border-control shadow-card flex cursor-pointer list-none items-center gap-2.5 rounded-xl border px-3 py-1.5 transition-colors [&::-webkit-details-marker]:hidden">
        <CalendarDays
          aria-hidden
          className="text-primary-text h-5 w-5"
          strokeWidth={1.9}
        />
        <span className="text-left leading-tight">
          <span className="sr-only">Periodo: </span>
          <span className="block text-sm font-extrabold">
            {periodLabel(current)}
          </span>
          <span className="text-muted-foreground hidden text-xs sm:block">
            {ranges[current]}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className="text-muted-foreground h-4 w-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="border-border bg-card shadow-lift absolute right-0 z-40 mt-2 w-60 rounded-xl border p-1.5">
        {(Object.keys(PERIODS) as PeriodKey[]).map((k) => (
          <li key={k}>
            <Link
              href={hrefFor(k)}
              onClick={() => ref.current?.removeAttribute('open')}
              aria-current={k === current ? 'true' : undefined}
              className={cn(
                'hover:bg-muted flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                k === current && 'text-primary-text font-extrabold',
              )}
            >
              <Check
                aria-hidden
                className={cn('h-4 w-4', k !== current && 'invisible')}
              />
              <span>
                <span className="block font-bold">{periodLabel(k)}</span>
                <span className="text-muted-foreground block text-xs">
                  {ranges[k]}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
