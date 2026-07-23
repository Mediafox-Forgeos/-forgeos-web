'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold">Algo salió mal</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Ocurrió un error inesperado. Puedes intentar de nuevo o volver más
        tarde.
      </p>
      <Button onClick={() => reset()}>Intentar de nuevo</Button>
    </div>
  );
}
