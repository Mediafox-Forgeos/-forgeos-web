'use client';

import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { ApiError } from '@/lib/api-client';
import { tenant } from '@/config/tenant';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Credenciales incorrectas');
      } else {
        setError('No fue posible conectarse con MOVOS. Intenta nuevamente.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="bg-movos-blue text-movos-blue-foreground grid size-11 place-items-center rounded-xl">
          <Zap className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {tenant.productName}
          </h1>
          <p className="text-muted-foreground text-sm">
            {tenant.productDescriptor}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <h2 className="text-base font-medium">Iniciar sesión</h2>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              >
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Accediendo…' : 'Acceder a MOVOS'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
