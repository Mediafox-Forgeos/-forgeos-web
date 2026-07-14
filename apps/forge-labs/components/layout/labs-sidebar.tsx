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
  { label: 'Architecture Review', href: '/architecture', icon: Network, available: false },
  { label: 'ADR Builder', href: '/adr', icon: BookOpenCheck, available: false },
  { label: 'Risk Analyzer', href: '/risk', icon: ShieldAlert, available: false },
  { label: 'Prompt Studio', href: '/prompts', icon: Terminal, available: false },
];

export function LabsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-[#0d0d10]">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="grid size-7 place-items-center rounded-md bg-foreground/10 text-foreground">
          <FlaskConical className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold tracking-tight">Forge Labs</p>
          <p className="text-[10px] text-muted-foreground">by MediaFOX</p>
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
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 text-sm text-muted-foreground">{mod.label}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
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
      <div className="border-t border-border p-4">
        <Link
          href={process.env.NEXT_PUBLIC_FORGEOS_URL ?? 'http://localhost:3000'}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>← Back to ForgeOS</span>
        </Link>
      </div>
    </aside>
  );
}
