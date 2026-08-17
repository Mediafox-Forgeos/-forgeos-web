'use client';

import { KeyRound } from 'lucide-react';
import * as React from 'react';
import type { ApiAuthorizationCredential } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/movos/empty-state';
import { apiClient } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { CredentialFormModal } from './credential-form-modal';

type LoadState = 'loading' | 'ready' | 'error';

export function CredentialsSection() {
  const { membership } = useAuth();
  const canCreate =
    membership?.role === 'OWNER' || membership?.role === 'ADMIN';

  const [credentials, setCredentials] = React.useState<
    ApiAuthorizationCredential[]
  >([]);
  const [state, setState] = React.useState<LoadState>('loading');
  const [modalOpen, setModalOpen] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const data =
        await apiClient.get<ApiAuthorizationCredential[]>('/credentials');
      setCredentials(data);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Credenciales de autorización (RFID, QR, app y otras) para esta
          organización.
        </p>
        {canCreate && credentials.length > 0 && (
          <Button size="sm" onClick={() => setModalOpen(true)}>
            Nueva credencial
          </Button>
        )}
      </div>

      {state === 'loading' && (
        <div className="grid gap-3">
          {[0, 1].map((key) => (
            <Card key={key} className="h-16 animate-pulse">
              <CardContent className="pt-4">
                <div className="bg-muted h-4 w-1/3 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {state === 'error' && (
        <EmptyState
          icon={KeyRound}
          title="No fue posible cargar las credenciales."
          description="Verifica tu conexión con MOVOS e intenta nuevamente."
          action={
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          }
        />
      )}

      {state === 'ready' && credentials.length === 0 && (
        <EmptyState
          icon={KeyRound}
          title="No hay credenciales registradas todavía."
          description="Crea una credencial para permitir Authorize/StartTransaction con un idTag conocido."
          action={
            canCreate ? (
              <Button onClick={() => setModalOpen(true)}>
                Nueva credencial
              </Button>
            ) : undefined
          }
        />
      )}

      {state === 'ready' && credentials.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-xs">
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Identificador</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Creada</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((credential) => (
                  <tr
                    key={credential.id}
                    className="border-border border-b last:border-0"
                  >
                    <td className="px-4 py-3">{credential.type}</td>
                    <td className="px-4 py-3 font-mono">
                      {credential.externalIdentifier}
                    </td>
                    <td className="px-4 py-3">{credential.status}</td>
                    <td className="px-4 py-3">
                      {formatDateTime(credential.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <CredentialFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(created) => setCredentials((prev) => [created, ...prev])}
      />
    </div>
  );
}
