import Link from 'next/link';
import { dataMode } from '@/lib/env';
import { ResetRequestForm } from './reset-request-form';

export const metadata = { title: 'Recuperar contraseña' };

export default function RecoverPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <p className="text-brand text-sm font-semibold uppercase tracking-widest">
        Hey Foxy
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Recuperar contraseña</h1>
      {dataMode() === 'supabase' ? (
        <ResetRequestForm />
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">
          No disponible en modo demostración.
        </p>
      )}
      <Link href="/login" className="text-brand mt-6 text-sm hover:underline">
        Volver a ingresar
      </Link>
    </main>
  );
}
