import { loginDemo } from '@/app/actions';
import { DemoBanner, buttonCls } from '@/components/ui';
import { DEMO_ORGS, DEMO_USERS } from '@/lib/demo/seed';
import { dataMode } from '@/lib/env';
import { PasswordForm } from './password-form';

export const metadata = { title: 'Ingresar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const demo = dataMode() === 'demo';
  return (
    <>
      {demo && <DemoBanner />}
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
        <p className="text-primary-text text-sm font-semibold uppercase tracking-widest">
          Hey Foxy
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Command Center</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Inteligencia social y reputacional.
        </p>
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
                  className="hover:bg-muted has-[:checked]:border-brand flex cursor-pointer items-start gap-3 rounded-lg border p-3"
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
            <button
              className={buttonCls.primary + ' w-full justify-center py-2'}
            >
              Entrar a la demostración
            </button>
            <p className="text-muted-foreground text-xs">
              Modo demostración: no hay cuentas reales conectadas ni envíos
              reales.
            </p>
          </form>
        ) : (
          <PasswordForm />
        )}
      </main>
    </>
  );
}
