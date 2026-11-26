import {
  BellRing,
  Building2,
  ChevronsUpDown,
  History,
  LogOut,
  Moon,
  Search,
  Sun,
} from 'lucide-react';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { logout, switchOrg } from '@/app/actions';
import { OrgSelect } from '@/components/shell/org-select';
import { setUiTheme } from '@/app/(app)/theme-actions';
import {
  ContextualCopilotPanel,
  CopilotProvider,
  CopilotTrigger,
} from '@/components/ds/copilot';
import { FoxyMark } from '@/components/ds/foxy';
import { Avatar } from '@/components/ds/primitives';
import { DemoBanner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PERIODS, periodRange, type PeriodKey } from '@/lib/period';
import type { ShellContext } from '@/lib/shell';
import { UI_THEME_LABEL, type UiTheme } from '@/lib/ui-theme';
import { MobileNav } from './mobile-nav';
import { PeriodLink } from './period-link';
import { PeriodPicker } from './period-picker';
import { SideNav } from './side-nav';

function Brand({ rail }: { rail?: boolean }) {
  // Nombre accesible = texto visible (WCAG 2.5.3). En el riel (md–xl) el texto queda solo para lectores.
  return (
    <PeriodLink href="/" className="flex items-center gap-2 rounded-xl px-1">
      <FoxyMark size={34} />
      <span
        className={cn(
          'flex items-center gap-1.5',
          rail && 'sr-only xl:not-sr-only xl:flex',
        )}
      >
        <span className="text-[19px] font-black tracking-tight">Hey Foxy</span>
        <span className="bg-brand text-brand-foreground rounded-full px-1.5 py-px text-[10px] font-black">
          v2
        </span>
      </span>
    </PeriodLink>
  );
}

/**
 * Selector de organización: muestra el nombre completo (hasta dos líneas, sin cortes) con
 * icono. Con varias organizaciones, el `<select>` nativo cubre la tarjeta (accesible y
 * operable con teclado) y «Cambiar» envía el formulario (funciona sin JavaScript).
 */
function OrgSwitcher({
  ctx,
  id,
  row,
}: {
  ctx: ShellContext;
  id: string;
  row?: boolean;
}) {
  const { memberships, active } = ctx;
  const many = memberships.length > 1;
  const name = active.organization.name;
  return (
    <form
      // Remonta el formulario al cambiar de organización: React restablece los campos de un
      // formulario tras su acción, y sin esto el <select> volvía a la organización anterior.
      key={active.organization.id}
      action={switchOrg}
      className={cn(
        'flex gap-1.5',
        row ? 'items-center' : 'flex-col items-stretch',
      )}
    >
      <div
        className={cn(
          'border-border bg-card focus-within:ring-primary-text relative flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 focus-within:ring-2',
          row ? 'py-1.5' : 'py-2',
          many && 'hover:border-control',
        )}
        title={name}
      >
        <span
          aria-hidden
          className="bg-primary-pale text-primary-text flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        >
          <Building2 className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          {!row && (
            <span className="text-muted-foreground block text-[10.5px] font-extrabold uppercase tracking-wider">
              Organización
            </span>
          )}
          <span
            className={cn(
              'block text-[13px] font-extrabold leading-tight',
              row ? 'truncate' : 'line-clamp-2',
            )}
          >
            {name}
          </span>
        </span>
        {many ? (
          <>
            <ChevronsUpDown
              aria-hidden
              className="text-muted-foreground h-4 w-4 shrink-0"
            />
            <label htmlFor={id} className="sr-only">
              Organización
            </label>
            <OrgSelect
              id={id}
              name="org"
              defaultValue={active.organization.id}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {memberships.map((m) => (
                <option key={m.organization.id} value={m.organization.id}>
                  {m.organization.name}
                </option>
              ))}
            </OrgSelect>
          </>
        ) : (
          <span className="sr-only">Organización activa</span>
        )}
      </div>
      {many && (
        <button
          className={cn(
            'text-primary-text hover:bg-primary-pale shrink-0 rounded-lg px-2 py-1 text-xs font-extrabold',
            !row && 'self-end',
          )}
        >
          {row ? 'Cambiar' : 'Cambiar organización'}
        </button>
      )}
    </form>
  );
}

const THEME_ICON = {
  'v2-light': Sun,
  'v2-dark': Moon,
  legacy: History,
} as const;

function ThemeSwitch({ theme }: { theme: UiTheme }) {
  return (
    <form
      action={setUiTheme}
      className="bg-muted flex rounded-xl p-0.5"
      aria-label="Tema de la interfaz"
    >
      {(Object.keys(THEME_ICON) as UiTheme[]).map((t) => {
        const Icon = THEME_ICON[t];
        return (
          <button
            key={t}
            name="theme"
            value={t}
            aria-pressed={theme === t}
            title={UI_THEME_LABEL[t]}
            className={cn(
              'flex flex-1 items-center justify-center rounded-lg py-1.5',
              theme === t
                ? 'bg-card text-primary-text shadow-card'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon aria-hidden className="h-4 w-4" />
            <span className="sr-only">Tema {UI_THEME_LABEL[t]}</span>
          </button>
        );
      })}
    </form>
  );
}

function UserCard({
  ctx,
  theme,
  rail,
}: {
  ctx: ShellContext;
  theme: UiTheme;
  rail?: boolean;
}) {
  return (
    <div
      className={cn('border-border space-y-3 border-t pt-4', rail && 'xl:px-1')}
    >
      <div className={cn('hidden', rail ? 'xl:block' : 'block')}>
        <ThemeSwitch theme={theme} />
      </div>
      <div
        className={cn(
          'flex items-center gap-2.5',
          rail && 'justify-center xl:justify-start',
        )}
      >
        <Link
          href="/configuracion"
          className="rounded-full"
          title="Configuración"
        >
          <Avatar name={ctx.viewer.name} size={38} />
          <span className="sr-only">Configuración de {ctx.viewer.name}</span>
        </Link>
        <div className={cn('min-w-0 flex-1', rail && 'hidden xl:block')}>
          <p className="truncate text-sm font-extrabold">{ctx.viewer.name}</p>
          <p className="text-muted-foreground text-xs">
            Rol: {ctx.active.role}
          </p>
        </div>
        <form action={logout} className={cn(rail && 'hidden xl:block')}>
          <button
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2"
            title="Salir"
          >
            <LogOut aria-hidden className="h-4 w-4" />
            <span className="sr-only">Salir</span>
          </button>
        </form>
      </div>
    </div>
  );
}

/** Shell de la interfaz V2 (WO-HF-V2-03). */
export function AppShell({
  ctx,
  theme,
  pendingAlerts,
  children,
}: {
  ctx: ShellContext;
  theme: UiTheme;
  pendingAlerts: number;
  children: ReactNode;
}) {
  const ranges = Object.fromEntries(
    (Object.keys(PERIODS) as PeriodKey[]).map((k) => [k, periodRange(k)]),
  ) as Record<PeriodKey, string>;
  return (
    <CopilotProvider>
      <div data-theme={theme} className="hf-v2 min-h-screen">
        <a
          href="#contenido"
          className="bg-brand text-brand-foreground sr-only z-50 rounded-lg px-3 py-2 font-bold focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Saltar al contenido
        </a>
        {ctx.active.organization.isDemo && <DemoBanner v2 />}
        <div className="md:flex">
          <aside className="hf-scroll-thin border-border bg-card sticky top-0 hidden h-screen shrink-0 flex-col gap-5 overflow-y-auto overflow-x-hidden border-r px-3 py-5 md:flex md:w-[84px] xl:w-[252px]">
            <Brand rail />
            <div className="hidden xl:block">
              <OrgSwitcher ctx={ctx} id="org-side" />
            </div>
            <Suspense>
              <SideNav pendingAlerts={pendingAlerts} />
            </Suspense>
            <div className="mt-auto">
              <UserCard ctx={ctx} theme={theme} rail />
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="border-border bg-background/85 sticky top-0 z-30 border-b backdrop-blur">
              <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-2.5 md:px-8">
                <Suspense>
                  <MobileNav
                    pendingAlerts={pendingAlerts}
                    header={<Brand />}
                    footer={
                      <div className="space-y-4">
                        <OrgSwitcher ctx={ctx} id="org-mobile" />
                        <UserCard ctx={ctx} theme={theme} />
                      </div>
                    }
                  />
                </Suspense>
                <div className="md:hidden">
                  <Brand />
                </div>
                <div className="hidden min-w-0 max-w-[19rem] md:block xl:hidden">
                  <OrgSwitcher ctx={ctx} id="org-top" row />
                </div>
                <form
                  action="/buscar"
                  role="search"
                  className="ml-auto hidden max-w-md flex-1 lg:ml-2 lg:block"
                >
                  <label htmlFor="q-global" className="sr-only">
                    Buscar en conversaciones y publicaciones
                  </label>
                  <div className="relative">
                    <Search
                      aria-hidden
                      className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    />
                    <input
                      id="q-global"
                      name="q"
                      type="search"
                      maxLength={100}
                      placeholder="Buscar conversaciones y publicaciones"
                      className="border-border bg-card placeholder:text-muted-foreground hover:border-control w-full rounded-xl border py-2 pl-9 pr-3 text-sm"
                    />
                  </div>
                </form>
                <div className="ml-auto flex items-center gap-1.5">
                  <PeriodLink
                    href="/buscar"
                    className="hover:bg-muted rounded-xl p-2 lg:hidden"
                  >
                    <Search aria-hidden className="h-5 w-5" />
                    <span className="sr-only">Buscar</span>
                  </PeriodLink>
                  <div className="hidden sm:block">
                    <Suspense>
                      <PeriodPicker ranges={ranges} />
                    </Suspense>
                  </div>
                  <PeriodLink
                    href="/alertas"
                    className="hover:bg-muted relative rounded-xl p-2"
                  >
                    <BellRing
                      aria-hidden
                      className="h-5 w-5"
                      strokeWidth={1.9}
                    />
                    {pendingAlerts > 0 && (
                      <span
                        aria-hidden
                        className="bg-critical-fg ring-background absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2"
                      />
                    )}
                    <span className="sr-only">
                      Alertas
                      {pendingAlerts > 0
                        ? `: ${pendingAlerts} pendientes de revisión`
                        : ''}
                    </span>
                  </PeriodLink>
                  <CopilotTrigger />
                </div>
              </div>
              <div className="border-border flex items-center justify-between gap-2 border-t px-4 py-2 sm:hidden">
                <Suspense>
                  <PeriodPicker ranges={ranges} />
                </Suspense>
              </div>
            </header>
            <main
              id="contenido"
              tabIndex={-1}
              className="mx-auto max-w-[1440px] px-4 py-6 outline-none md:px-8"
            >
              {children}
            </main>
          </div>
        </div>
        <Suspense>
          <ContextualCopilotPanel orgName={ctx.active.organization.name} />
        </Suspense>
      </div>
    </CopilotProvider>
  );
}
