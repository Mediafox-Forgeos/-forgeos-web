'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  FolderKanban,
  LayoutGrid,
  Menu,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NavigationItem } from '@/types';

const navigation: NavigationItem[] = [
  { label: 'Inicio', href: '/', icon: LayoutGrid },
  { label: 'ARGOS', href: '/#argos', icon: Bot },
  { label: 'Clientes', href: '/#clientes', icon: BriefcaseBusiness },
  { label: 'Proyectos', href: '/#proyectos', icon: FolderKanban },
  { label: 'Knowledge', href: '/#knowledge', icon: BookOpen },
  { label: 'Configuración', href: '/#configuracion', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur lg:hidden">
        <Brand />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir navegación"
        >
          <Menu className="size-5" />
        </Button>
      </header>

      {isOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-label="Cerrar navegación"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-[#0d0d10] p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar navegación"
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="space-y-1" aria-label="Navegación principal">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/' ? pathname === '/' : false;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'group flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  active && 'bg-accent text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.label === 'ARGOS' && (
                  <span
                    className="size-1.5 rounded-full bg-emerald-400"
                    aria-label="Activo"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-[#27272a] text-xs font-semibold">
              MF
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Mediafox</p>
              <p className="truncate text-xs text-muted-foreground">
                Plan Alpha
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-sm font-semibold tracking-tight"
    >
      <span className="grid size-7 place-items-center rounded-md bg-foreground text-background">
        <Sparkles className="size-4" aria-hidden="true" />
      </span>
      ForgeOS
    </Link>
  );
}
