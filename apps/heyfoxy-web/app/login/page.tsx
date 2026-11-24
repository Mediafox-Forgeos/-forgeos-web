import { Bell, ShieldCheck, Sparkles } from 'lucide-react';
import { loginDemo } from '@/app/actions';
import { FoxyMark } from '@/components/ds/foxy';
import { DemoBanner, buttonCls } from '@/components/ui';
import { DEMO_ORGS, DEMO_USERS } from '@/lib/demo/seed';
import { cn } from '@/lib/cn';
import { dataMode } from '@/lib/env';
import { getUiTheme } from '@/lib/shell';
import { isV2 } from '@/lib/ui-theme';
import { PasswordForm } from './password-form';

export const metadata = { title: 'Ingresar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const demo = dataMode() === 'demo';
  const theme = await getUiTheme();
  const v2 = isV2(theme);
  const content = (
    <>
      {v2 ? (
        <div className="flex items-center gap-3">
          <FoxyMark size={44} />
          <div>
            <p className="text-[22px] font-black leading-none tracking-tight">
              Hey Foxy{' '}
              <span className="bg-brand text-brand-foreground ml-0.5 rounded-full px-1.5 py-px align-middle text-[10px] font-black">
                v2
              </span>
            </p>
            <p className="text-muted-foreground mt-1 text-sm font-semibold">
              Inteligencia social y reputacional
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-primary-text text-sm font-semibold uppercase tracking-widest">
            Hey Foxy
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Command Center</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Inteligencia social y reputacional.
          </p>
        </>
      )}
      {v2 && (
        <h1 className="mt-8 text-[28px] font-black leading-tight tracking-tight">
          Ingresa a tu espacio
        </h1>
      )}
      {error === 'enlace-invalido' && (
        <p
          role="alert"
          className="border-critical-border bg-critical-soft mt-4 rounded-md border p-2 text-sm"
        >
          El enlace no es válido o expiró. Solicita uno nuevo.
        </p>
      )}
      {error === 'sin-organizacion' && (
        <p
          role="alert"
          className="border-critical-border bg-critical-soft mt-4 rounded-md border p-2 text-sm"
        >
          Tu usuario no pertenece a ninguna organización.
        </p>
      )}
      {demo ? (
        <form action={loginDemo} className="mt-6 space-y-3">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">
              Ingresar como persona de demostración
            </legend>
            {DEMO_USERS.map((u, i) => (
              <label
                key={u.id}
                className={cn(
                  'hover:bg-muted has-[:checked]:border-brand flex cursor-pointer items-start gap-3 border p-3',
                  v2 ? 'bg-card rounded-xl' : 'rounded-lg',
                )}
              >
                <input
                  type="radio"
                  name="user"
                  value={u.id}
                  defaultChecked={i === 0}
                  className="mt-1 accent-[hsl(var(--brand))]"
                />
                <span>
                  <span className="block text-sm font-medium">{u.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {u.memberships
                      .map(
                        (m) =>
                          `${DEMO_ORGS.find((o) => o.id === m.org)?.name} · ${m.role}`,
                      )
                      .join(' / ')}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <button className={buttonCls.primary + ' w-full justify-center py-2'}>
            Entrar a la demostración
          </button>
          <p className="text-muted-foreground text-xs">
            Modo demostración: no hay cuentas reales conectadas ni envíos
            reales.
          </p>
        </form>
      ) : (
        <PasswordForm v2={v2} />
      )}
    </>
  );

  if (!v2)
    return (
      <>
        {demo && <DemoBanner />}
        <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
          {content}
        </main>
      </>
    );

  // Login V2 (Fase B, punto 10): panel de marca con Foxy y tarjeta de acceso.
  return (
    <div data-theme={theme} className="hf-v2 flex min-h-screen flex-col">
      {demo && <DemoBanner v2 />}
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <section
          aria-hidden
          className="from-mod-home via-primary-pale/70 to-background relative hidden overflow-hidden bg-gradient-to-br p-12 lg:flex lg:flex-col lg:justify-between"
        >
          <p className="text-primary-text text-xs font-extrabold uppercase tracking-[0.14em]">
            Command Center
          </p>
          <div className="max-w-md">
            <FoxyMark variant="illustration" size={180} />
            <p className="mt-6 text-[32px] font-black leading-tight tracking-tight">
              Escucha, entiende y actúa sobre tu reputación digital.
            </p>
            <ul className="text-muted-foreground mt-6 space-y-3 text-[15px] font-semibold">
              <li className="flex items-center gap-2.5">
                <Sparkles className="text-primary-text h-5 w-5" /> Hallazgos de
                Foxy con evidencia citada
              </li>
              <li className="flex items-center gap-2.5">
                <Bell className="text-primary-text h-5 w-5" /> Alertas con
                revisión humana antes de escalar
              </li>
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="text-primary-text h-5 w-5" /> Datos
                aislados por organización
              </li>
            </ul>
          </div>
          <p className="text-muted-foreground text-xs">MediaFOX · Hey Foxy</p>
        </section>
        <main className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="border-border/80 bg-card shadow-card rounded-panel w-full max-w-md border p-6 sm:p-8">
            {content}
          </div>
        </main>
      </div>
    </div>
  );
}
