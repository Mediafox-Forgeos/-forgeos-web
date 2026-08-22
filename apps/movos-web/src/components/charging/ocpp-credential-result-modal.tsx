'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { OcppProvisioningResult } from '@/lib/charging-api';

/**
 * Shared one-time-secret display for both first-time OCPP provisioning and
 * credential rotation — same response shape, same handling requirement:
 * the secret is held only in this component's own local state (never
 * localStorage/sessionStorage/cookies/global state/logs) and is discarded
 * the moment the caller unmounts this modal.
 */
export function OcppCredentialResultModal({
  title,
  result,
  onClose,
}: {
  title: string;
  result: OcppProvisioningResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState<'identity' | 'secret' | null>(
    null,
  );

  async function copy(
    value: string,
    which: 'identity' | 'secret',
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the value is still
      // shown on screen for manual copy, so this is not fatal.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocpp-credential-result-title"
    >
      <div className="border-border bg-background w-full max-w-lg rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="ocpp-credential-result-title"
            className="text-lg font-semibold"
          >
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </Button>
        </div>

        <p
          role="alert"
          className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500"
        >
          Este secreto se muestra una sola vez. Guárdalo ahora en un lugar
          seguro — MOVOS no lo volverá a mostrar.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-muted-foreground mb-1 text-xs">Identidad OCPP</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 break-all rounded-md px-3 py-2 text-sm">
                {result.ocppIdentity}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copy(result.ocppIdentity, 'identity')}
              >
                {copied === 'identity' ? 'Copiado' : 'Copiar identidad'}
              </Button>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-1 text-xs">Secreto</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 break-all rounded-md px-3 py-2 text-sm">
                {result.plaintextSecret}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copy(result.plaintextSecret, 'secret')}
              >
                {copied === 'secret' ? 'Copiado' : 'Copiar secreto'}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={onClose}>
            Ya copié ambos valores
          </Button>
        </div>
      </div>
    </div>
  );
}
