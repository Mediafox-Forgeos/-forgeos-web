'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Cable,
  CircleGauge,
  FileBarChart,
  LayoutDashboard,
  Menu,
  MapPin,
  Plug,
  Settings,
  Receipt,
  ServerCog,
  TriangleAlert,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { tenant } from '@/config/tenant';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NavItem = { label: string; href: string; icon: LucideIcon };

const navigation: NavItem[] = [
  { label: 'Resumen', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Sitios', href: '/sites', icon: MapPin },
  { label: 'Estaciones', href: '/stations', icon: ServerCog },
  { label: 'Cargadores', href: '/chargers', icon: Plug },
  { label: 'Conectores', href: '/connectors', icon: Cable },
  { label: 'Sesiones', href: '/sessions', icon: CircleGauge },
  { label: 'Usuarios', href: '/users', icon: Users },
  { label: 'Tarifas', href: '/tariffs', icon: Receipt },
  { label: 'Alertas', href: '/alerts', icon: TriangleAlert },
  { label: 'Reportes', href: '/reports', icon: FileBarChart },
  { label: 'Configuración', href: '/settings', icon: Settings },
];

export function MovosSidebar() {
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
          'border-border fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-[#0a1020] p-3 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
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

        <div className="border-border mx-1 mb-4 rounded-lg border px-3 py-2">
          <p className="text-foreground text-sm font-medium">
            {tenant.orgName}
          </p>
          <span className="border-movos-blue/40 bg-movos-blue/10 text-movos-blue mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            {tenant.orgDescription}
          </span>
        </div>

        <nav
          className="space-y-1 overflow-y-auto"
          aria-label="Navegación principal"
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
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

        <div className="border-border mt-auto flex items-center justify-between gap-2 border-t px-2 pt-3">
          <div className="flex items-center gap-2">
            <span className="bg-movos-blue/20 text-movos-blue grid size-8 place-items-center rounded-full">
              <UserRound className="size-4" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="text-xs font-medium">Operador</p>
              <p className="text-muted-foreground text-[10px]">Sesión demo</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notificaciones"
            disabled
          >
            <Bell className="size-4" />
          </Button>
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 text-sm font-semibold tracking-tight"
    >
      <span className="bg-movos-blue text-movos-blue-foreground grid size-7 place-items-center rounded-md">
        <Zap className="size-4" aria-hidden="true" />
      </span>
      {tenant.productName}
    </Link>
  );
}
