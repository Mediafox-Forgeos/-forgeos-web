'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  BookOpen,
  BriefcaseBusiness,
  ClipboardList,
  FileCheck2,
  FlaskConical,
  FolderKanban,
  Menu,
  Settings,
  Sparkles,
  PanelsTopLeft,
  X,
  Zap,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NavigationItem } from '@/types';

const navigation: NavigationItem[] = [
  { label: 'ARGOS', href: '/argos', icon: Bot },
  { label: 'Workspace', href: '/workspace', icon: PanelsTopLeft },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Clients', href: '/clients', icon: BriefcaseBusiness },
  { label: 'Roadmap', href: '/roadmap', icon: ClipboardList },
  { label: 'Decisions', href: '/decisions', icon: FileCheck2 },
  { label: 'Knowledge', href: '/knowledge', icon: BookOpen },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const FORGE_LABS_URL =
  process.env.NEXT_PUBLIC_FORGE_LABS_URL ?? 'http://localhost:3001';

const MOVOS_URL = process.env.NEXT_PUBLIC_MOVOS_URL ?? 'http://localhost:3002';

export function AppSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <header className="border-border bg-background/95 sticky top-0 z-30 flex h-16 items-center justify-between border-b px-5 backdrop-blur lg:hidden">
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
          'border-border fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-[#0d0d10] p-3 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-10 flex items-center justify-between px-2">
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
            const active =
              item.href === '/projects'
                ? pathname.startsWith('/projects')
                : pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'text-muted-foreground hover:bg-accent hover:text-foreground group flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                  active && 'bg-accent text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* External product links */}
        <div className="border-border mx-2 mb-2 space-y-1 border-t pt-2">
          <a
            href={FORGE_LABS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:bg-accent hover:text-foreground group flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors"
          >
            <FlaskConical className="size-4" aria-hidden="true" />
            <span className="flex-1">Forge Labs</span>
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
              New
            </span>
          </a>
          <a
            href={MOVOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:bg-accent hover:text-foreground group flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors"
          >
            <Zap className="size-4" aria-hidden="true" />
            <span className="flex-1">MOVOS</span>
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
              New
            </span>
          </a>
        </div>

        <div className="mt-auto px-3 pb-2">
          <p className="text-muted-foreground text-xs">Mediafox · Alpha</p>
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
      <span className="bg-foreground text-background grid size-7 place-items-center rounded-md">
        <Sparkles className="size-4" aria-hidden="true" />
      </span>
      ForgeOS
    </Link>
  );
}
