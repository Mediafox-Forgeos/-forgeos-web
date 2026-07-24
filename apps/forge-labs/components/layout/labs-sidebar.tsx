'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FlaskConical,
  Sparkles,
  FileText,
  Network,
  ShieldAlert,
  BookOpenCheck,
  Terminal,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type LabModule = {
  label: string;
  href: string;
  icon: React.ElementType;
  available: boolean;
};

const modules: LabModule[] = [
  { label: 'Naming Engine', href: '/naming', icon: Sparkles, available: true },
  { label: 'PRD Generator', href: '/prd', icon: FileText, available: false },
  {
    label: 'Architecture Review',
    href: '/architecture',
    icon: Network,
    available: false,
  },
  { label: 'ADR Builder', href: '/adr', icon: BookOpenCheck, available: false },
  {
    label: 'Risk Analyzer',
    href: '/risk',
    icon: ShieldAlert,
    available: false,
  },
  {
    label: 'Prompt Studio',
    href: '/prompts',
    icon: Terminal,
    available: false,
  },
];

export function LabsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-border flex w-52 shrink-0 flex-col border-r bg-[#0d0d10]">
      {/* Brand */}
      <div className="border-border flex h-14 items-center gap-2.5 border-b px-4">
        <div className="bg-foreground/10 text-foreground grid size-7 place-items-center rounded-md">
          <FlaskConical className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold tracking-tight">Forge Labs</p>
          <p className="text-muted-foreground text-[10px]">by MediaFOX</p>
        </div>
      </div>

      {/* Modules */}
      <nav className="flex-1 space-y-0.5 p-3" aria-label="Lab modules">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const active = pathname.startsWith(mod.href) && mod.available;

          if (!mod.available) {
            return (
              <div
                key={mod.label}
                className="flex h-9 cursor-default items-center gap-2.5 rounded-md px-3 opacity-40"
              >
                <Icon
                  className="text-muted-foreground size-4"
                  aria-hidden="true"
                />
                <span className="text-muted-foreground flex-1 text-sm">
                  {mod.label}
                </span>
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
                  Soon
                </span>
              </div>
            );
          }

          return (
            <Link
              key={mod.label}
              href={mod.href}
              className={cn(
                'group flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors',
                active
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="flex-1">{mod.label}</span>
              {active && <ChevronRight className="size-3 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-border border-t p-4">
        <Link
          href={process.env.NEXT_PUBLIC_FORGEOS_URL ?? 'http://localhost:3000'}
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-xs transition-colors"
        >
          <span>← Back to ForgeOS</span>
        </Link>
      </div>
    </aside>
  );
}
