import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <section className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-12 inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-background">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          ForgeOS
        </Link>
        <div className="rounded-2xl border border-border bg-card p-7 shadow-2xl shadow-black/20 sm:p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              Bienvenido de nuevo
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Inicia sesión para volver a tu espacio de trabajo.
            </p>
          </div>
          <form className="space-y-4">
            <label className="block space-y-2 text-sm font-medium">
              Correo electrónico
              <Input
                type="email"
                placeholder="tu@empresa.com"
                autoComplete="email"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Contraseña
              <Input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            <Button className="mt-2 w-full" type="submit">
              Iniciar sesión{' '}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
