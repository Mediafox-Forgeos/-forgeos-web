'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, type FocusEvent, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import { PERIOD_PARAM, parsePeriod, withPeriod } from '@/lib/period';
import { NAV, isActive } from './nav-items';

/**
 * Navegación principal V2. `rail`: en tablet (md–xl) solo iconos con tooltip; desde
 * xl, iconos y texto. En el panel móvil se muestra siempre con texto.
 * Conserva `?periodo` al navegar.
 *
 * El tooltip del riel es `position: fixed` y se coloca junto al enlace: así no lo recorta
 * el `overflow` del riel ni crea scroll horizontal (defecto del Preview V2, captura 18).
 */
export function SideNav({
  pendingAlerts,
  variant = 'rail',
  onNavigate,
}: {
  pendingAlerts: number;
  variant?: 'rail' | 'full';
  onNavigate?: () => void;
}) {
  const path = usePathname();
  const period = parsePeriod(useSearchParams().get(PERIOD_PARAM));
  const rail = variant === 'rail';
  const [tip, setTip] = useState<{
    label: string;
    top: number;
    left: number;
  } | null>(null);
  const showTip =
    (label: string) =>
    (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
      // Solo en el riel de iconos (md–xl); desde xl el texto ya es visible.
      if (
        !rail ||
        !window.matchMedia('(min-width: 768px) and (max-width: 1279.98px)')
          .matches
      )
        return;
      const r = e.currentTarget.getBoundingClientRect();
      // Se ancla al borde del riel (no del enlace) para no quedar sobre él.
      const edge =
        e.currentTarget.closest('aside')?.getBoundingClientRect().right ??
        r.right;
      setTip({ label, top: r.top + r.height / 2, left: edge + 8 });
    };
  const hideTip = () => setTip(null);
  return (
    <nav aria-label="Principal" className="space-y-5">
      {NAV.map((g, gi) => (
        <div key={g.label ?? gi}>
          {g.label && (
            <p
              className={cn(
                'text-muted-foreground mb-1.5 px-3 text-[11px] font-extrabold uppercase tracking-[0.1em]',
                rail && 'hidden xl:block',
              )}
            >
              {g.label}
            </p>
          )}
          {g.label && rail && (
            <hr
              aria-hidden
              className="border-border mx-auto mb-2 w-8 xl:hidden"
            />
          )}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(it.href, path);
              const count = it.badge === 'alerts' ? pendingAlerts : 0;
              return (
                <li
                  key={it.href}
                  onMouseEnter={showTip(it.label)}
                  onMouseLeave={hideTip}
                  onFocus={showTip(it.label)}
                  onBlur={hideTip}
                >
                  <Link
                    href={withPeriod(it.href, period)}
                    onClick={() => {
                      hideTip();
                      onNavigate?.();
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'duration-fast flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-semibold transition-colors',
                      rail && 'justify-center xl:justify-start',
                      active
                        ? 'bg-primary-pale text-primary-text font-extrabold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span className="relative">
                      <it.icon
                        aria-hidden
                        className="h-5 w-5"
                        strokeWidth={1.9}
                      />
                      {count > 0 && rail && (
                        <span
                          aria-hidden
                          className="bg-critical-fg text-card absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black xl:hidden"
                        >
                          {count}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn('flex-1', rail && 'sr-only xl:not-sr-only')}
                    >
                      {it.label}
                    </span>
                    {count > 0 && (
                      <span
                        className={cn(
                          'bg-critical-fg text-card rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums',
                          rail && 'hidden xl:inline',
                        )}
                      >
                        {count}
                        <span className="sr-only"> pendientes</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {tip && (
        <span
          aria-hidden
          className="bg-foreground text-background shadow-lift pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold"
          style={{ top: tip.top, left: tip.left }}
        >
          {tip.label}
        </span>
      )}
    </nav>
  );
}
