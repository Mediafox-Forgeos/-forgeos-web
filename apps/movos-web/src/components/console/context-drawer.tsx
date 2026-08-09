'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Kylum Console (WO-ARGOS-031) — the one contextual-drawer pattern shared by
 * every drill-down in the console (station detail on /network, case detail
 * on /operations, and in principle session/technician detail wherever
 * those are added next). A single shared component, not one per screen —
 * per this work order's "avoid creating duplicate components" instruction,
 * and per docs/product/KYLUM_CONSOLE_NAVIGATION.md's "the operator should
 * never leave the current screen" drill-down rule: this renders as a
 * slide-in overlay, never a route change, so whatever is open underneath
 * (the map, the case columns) stays exactly as the operator left it.
 */
export function ContextDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Cerrar panel"
      />
      <aside
        className={cn(
          'border-border bg-card absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l shadow-2xl',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="border-border flex items-start justify-between gap-3 border-b p-5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-[-0.01em]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {subtitle}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar panel"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
