'use client';

import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';
import type { ApiOrganization } from '@mediafox/shared-types';

import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

/**
 * DEC-022 Invariant 4: organization switching only ever happens through an
 * explicit selection here, which calls `AuthContext.selectOrganization` —
 * there is no implicit or automatic re-selection once a token is bound.
 *
 * `variant="dropdown"` is the compact sidebar control used once an
 * organization is already active, letting the user explicitly switch to a
 * different one. `variant="list"` is the full-page selector shown when the
 * access token has no organization yet (a user with zero or multiple
 * ACTIVE memberships must choose one before continuing).
 */
export function OrganizationSwitcher({
  variant = 'dropdown',
}: {
  variant?: 'dropdown' | 'list';
}) {
  const { currentOrg, organizations, selectOrganization } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  async function handleSelect(org: ApiOrganization): Promise<void> {
    if (org.id === currentOrg?.id) {
      setIsOpen(false);
      return;
    }
    setPendingId(org.id);
    setError(null);
    try {
      await selectOrganization(org.id);
      setIsOpen(false);
    } catch {
      setError('No se pudo cambiar de organización. Intenta de nuevo.');
    } finally {
      setPendingId(null);
    }
  }

  if (variant === 'list') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
        <div className="text-center">
          <h1 className="text-foreground text-lg font-semibold">
            Selecciona una organización
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tu cuenta pertenece a varias organizaciones. Elige con cuál quieres
            trabajar en esta sesión.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              disabled={pendingId !== null}
              onClick={() => void handleSelect(org)}
              className="border-border bg-card hover:bg-accent flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="bg-movos-blue/20 text-movos-blue grid size-9 shrink-0 place-items-center rounded-full">
                <Building2 className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-sm font-medium">
                  {org.name}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {org.slug}
                </span>
              </span>
              {pendingId === org.id && (
                <span className="text-muted-foreground text-xs">…</span>
              )}
            </button>
          ))}
        </div>
        {error && <p className="text-center text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  if (organizations.length <= 1) {
    return (
      <div className="border-border mx-1 mb-4 rounded-lg border px-3 py-2">
        <p className="text-foreground truncate text-sm font-medium">
          {currentOrg?.name ?? '—'}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative mx-1 mb-4">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="border-border bg-card hover:bg-accent flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm font-medium">
            {currentOrg?.name ?? 'Sin organización'}
          </span>
        </span>
        <ChevronsUpDown
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="border-border bg-popover absolute inset-x-0 top-[calc(100%+4px)] z-10 overflow-hidden rounded-lg border shadow-lg"
        >
          {organizations.map((org) => {
            const isActive = org.id === currentOrg?.id;
            return (
              <button
                key={org.id}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={pendingId !== null}
                onClick={() => void handleSelect(org)}
                className={cn(
                  'hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-50',
                  isActive && 'text-movos-blue',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{org.name}</span>
                {isActive && (
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mt-1 px-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
