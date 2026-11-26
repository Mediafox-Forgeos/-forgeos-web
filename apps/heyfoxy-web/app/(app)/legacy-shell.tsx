import { logout, switchOrg } from '@/app/actions';
import { OrgSelect } from '@/components/shell/org-select';
import { DemoBanner } from '@/components/ui';
import type { ShellContext } from '@/lib/shell';
import { LogOut } from 'lucide-react';
import { Nav } from './nav';

/** Shell V1 (tema «Clásico»), sin cambios respecto de Gate 2. Alternativa durante la transición (D-1). */
export function LegacyShell({
  ctx: { viewer, memberships, active },
  children,
}: {
  ctx: ShellContext;
  children: React.ReactNode;
}) {
  return (
    <>
      {active.organization.isDemo && <DemoBanner />}
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="border-b p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
          <p className="text-primary-text px-2 text-sm font-semibold uppercase tracking-widest">
            Hey Foxy
          </p>
          <form
            key={active.organization.id}
            action={switchOrg}
            className="mt-3 px-2"
          >
            <label htmlFor="org" className="sr-only">
              Organización
            </label>
            <OrgSelect
              id="org"
              name="org"
              defaultValue={active.organization.id}
              className="bg-background w-full rounded-md border px-2 py-1.5 text-sm"
            >
              {memberships.map((m) => (
                <option key={m.organization.id} value={m.organization.id}>
                  {m.organization.name}
                </option>
              ))}
            </OrgSelect>
            {memberships.length > 1 && (
              <button className="text-primary-text mt-1 text-xs hover:underline">
                Cambiar organización
              </button>
            )}
          </form>
          <div className="mt-5 hidden md:block">
            <Nav />
          </div>
          <details className="mt-3 md:hidden">
            <summary className="cursor-pointer px-2 text-sm">Menú</summary>
            <div className="mt-3">
              <Nav />
            </div>
          </details>
          <div className="text-muted-foreground mt-6 border-t px-2 pt-3 text-xs">
            <p className="text-foreground truncate">{viewer.name}</p>
            <p>Rol: {active.role}</p>
            <form action={logout} className="mt-2">
              <button className="hover:text-foreground inline-flex items-center gap-1">
                <LogOut aria-hidden className="h-3.5 w-3.5" /> Salir
              </button>
            </form>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </>
  );
}
