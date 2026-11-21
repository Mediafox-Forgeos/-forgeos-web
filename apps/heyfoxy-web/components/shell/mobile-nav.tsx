'use client';

import { Menu, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { SideNav } from './side-nav';

/** Menú móvil (< md): panel lateral modal con la navegación completa, organización y usuario. */
export function MobileNav({
  pendingAlerts,
  header,
  footer,
}: {
  pendingAlerts: number;
  header: ReactNode;
  footer: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = openRef.current;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={openRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
        className="hover:bg-muted rounded-xl p-2 md:hidden"
      >
        <Menu aria-hidden className="h-6 w-6" />
        <span className="sr-only">Abrir menú</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden
            className="bg-foreground/40 absolute inset-0"
            onClick={() => setOpen(false)}
          />
          <div
            id={id}
            role="dialog"
            aria-modal="true"
            aria-label="Menú principal"
            className="bg-card shadow-lift absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col overflow-y-auto p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              {header}
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="hover:bg-muted rounded-xl p-2"
              >
                <X aria-hidden className="h-5 w-5" />
                <span className="sr-only">Cerrar menú</span>
              </button>
            </div>
            <SideNav
              pendingAlerts={pendingAlerts}
              variant="full"
              onNavigate={() => setOpen(false)}
            />
            <div className="mt-auto pt-6">{footer}</div>
          </div>
        </div>
      )}
    </>
  );
}
