import Link from 'next/link';
import { dataMode } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';
import { NewPasswordForm } from './new-password-form';

export const metadata = { title: 'Nueva contraseña' };
export const dynamic = 'force-dynamic';

/** Solo accesible con la sesión creada por el enlace de recuperación. */
export default async function NewPasswordPage() {
  let hasSession = false;
  if (dataMode() === 'supabase') {
    const { data } = await (await supabaseServer()).auth.getUser();
    hasSession = Boolean(data.user);
  }
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <p className="text-primary-text text-sm font-semibold uppercase tracking-widest">
        Hey Foxy
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Nueva contraseña</h1>
      {hasSession ? (
        <NewPasswordForm />
      ) : (
        <>
          <p role="alert" className="mt-4 text-sm">
            El enlace no es válido o expiró.
          </p>
          <Link
            href="/login/recuperar"
            className="text-primary-text mt-4 text-sm hover:underline"
          >
            Solicitar un nuevo enlace
          </Link>
        </>
      )}
    </main>
  );
}
