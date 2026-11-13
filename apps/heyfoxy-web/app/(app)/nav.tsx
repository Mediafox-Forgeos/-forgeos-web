'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import {
  Activity,
  BellRing,
  ClipboardCheck,
  Gauge,
  MessageSquareText,
  MessagesSquare,
  Radar,
  Settings,
  ShieldAlert,
  Tags,
} from 'lucide-react';

const GROUPS = [
  {
    label: 'Inteligencia reputacional',
    items: [
      { href: '/', label: 'Resumen', icon: Gauge },
      { href: '/alertas', label: 'Alertas', icon: BellRing },
      { href: '/revision', label: 'Revisión humana', icon: ClipboardCheck },
      { href: '/incidentes', label: 'Incidentes', icon: ShieldAlert },
      { href: '/temas', label: 'Temas', icon: Tags },
    ],
  },
  {
    label: 'Escucha operativa',
    items: [
      {
        href: '/conversaciones',
        label: 'Conversaciones',
        icon: MessagesSquare,
      },
      { href: '/cobertura', label: 'Fuentes y cobertura', icon: Radar },
    ],
  },
  {
    label: 'Plataforma',
    items: [
      { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquareText },
      { href: '/uso', label: 'Uso y presupuestos', icon: Activity },
      { href: '/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="space-y-5">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="text-muted-foreground px-2 text-[11px] font-semibold uppercase tracking-wider">
            {g.label}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {g.items.map((it) => {
              const active =
                it.href === '/' ? path === '/' : path.startsWith(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                      active && 'bg-muted text-foreground',
                    )}
                  >
                    <it.icon aria-hidden className="h-4 w-4" /> {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
