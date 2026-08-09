'use client';

import { Bell, ChevronDown, Search, UserRound } from 'lucide-react';
import * as React from 'react';

import type { ApiAction } from '@mediafox/shared-types';

import { useAuth } from '@/context/auth-context';
import { setActiveOrganizationId } from '@/lib/auth';
import { usePolledResource } from '@/components/operator/use-polled-resource';
import { cn } from '@/lib/utils';

const OPEN_STATUSES = new Set(['OPEN', 'ACKNOWLEDGED', 'ASSIGNED']);

/**
 * Kylum Console (WO-ARGOS-031) — the global top bar: organization selector,
 * search, notifications, and operator profile, persistent across every
 * screen (mirrors the sidebar's own persistence). The notification count is
 * real data (open Actions, ActionService — WO-ARGOS-026), not a mock badge.
 * Search has no backend search endpoint to call yet — it is rendered as a
 * real input, honestly not wired to a live query, exactly the same
 * disclosure discipline docs/product/KYLUM_CONSOLE_WIREFRAMES.md already
 * applies to not-yet-real data elsewhere in the console.
 */
export function ConsoleTopBar() {
  const { currentUser, currentOrg, organizations } = useAuth();
  const { data: actions } = usePolledResource<ApiAction[]>('/actions', 30_000);
  const [orgMenuOpen, setOrgMenuOpen] = React.useState(false);

  const openCount =
    actions?.filter((a) => OPEN_STATUSES.has(a.status)).length ?? 0;

  return (
    <header className="border-border bg-background/95 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-5 backdrop-blur">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOrgMenuOpen((v) => !v)}
          disabled={organizations.length < 2}
          className="hover:bg-accent flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium disabled:cursor-default disabled:hover:bg-transparent"
        >
          {currentOrg?.name ?? 'Organización'}
          {organizations.length > 1 && (
            <ChevronDown className="text-muted-foreground size-3.5" />
          )}
        </button>
        {orgMenuOpen && organizations.length > 1 && (
          <div className="border-border bg-card absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border p-1 shadow-lg">
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  setActiveOrganizationId(org.id);
                  setOrgMenuOpen(false);
                  window.location.reload();
                }}
                className={cn(
                  'hover:bg-accent flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm',
                  org.id === currentOrg?.id && 'text-movos-blue',
                )}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative ml-2 hidden max-w-sm flex-1 sm:block">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <input
          type="search"
          placeholder="Buscar estaciones, sesiones, acciones…"
          className="border-border bg-accent/40 placeholder:text-muted-foreground focus:ring-movos-blue h-9 w-full rounded-lg border pl-9 pr-3 text-sm outline-none focus:ring-1"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          className="hover:bg-accent relative flex size-9 items-center justify-center rounded-lg"
          aria-label={`${openCount} acciones abiertas`}
          title={`${openCount} acciones abiertas`}
        >
          <Bell className="text-muted-foreground size-4" />
          {openCount > 0 && (
            <span className="bg-movos-blue text-movos-blue-foreground absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full text-[10px] font-semibold">
              {openCount > 9 ? '9+' : openCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 pl-1.5">
          <span className="bg-movos-blue/20 text-movos-blue grid size-8 shrink-0 place-items-center rounded-full">
            <UserRound className="size-4" aria-hidden="true" />
          </span>
          <span className="hidden text-sm font-medium md:inline">
            {currentUser?.displayName ?? 'Operador'}
          </span>
        </div>
      </div>
    </header>
  );
}
