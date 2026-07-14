'use client';

import { FlaskConical, X } from 'lucide-react';
import * as React from 'react';

export function DemoBanner() {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;

  return (
    <div className="border-movos-blue/30 bg-movos-blue/10 flex items-center justify-between gap-3 border-b px-5 py-2 text-xs">
      <span className="text-movos-blue flex items-center gap-2">
        <FlaskConical className="size-3.5" aria-hidden="true" />
        Entorno piloto · Datos de demostración
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Cerrar aviso"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
