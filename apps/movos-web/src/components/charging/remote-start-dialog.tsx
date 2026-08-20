'use client';

import * as React from 'react';
import type { ApiAuthorizationCredential } from '@mediafox/shared-types';

import { listCredentials, requestRemoteStart } from '@/lib/remote-commands-api';
import { RemoteCommandModal } from './remote-command-modal';

interface RemoteStartDialogProps {
  open: boolean;
  onClose: () => void;
  connectorId: string;
  siteName: string;
  stationName: string;
  evseName: string;
  connectorLabel: string;
}

/** WO-ARGOS-064 §6 — the operator selects an EXISTING real
 * AuthorizationCredential; never a free-text idTag, never a synthetic
 * credential created here. The backend re-resolves and validates it. */
export function RemoteStartDialog({
  open,
  onClose,
  connectorId,
  siteName,
  stationName,
  evseName,
  connectorLabel,
}: RemoteStartDialogProps) {
  const [credentials, setCredentials] = React.useState<
    ApiAuthorizationCredential[]
  >([]);
  const [credentialId, setCredentialId] = React.useState('');
  const [loadingCredentials, setLoadingCredentials] = React.useState(true);

  React.useEffect(() => {
    if (!open) return;
    setLoadingCredentials(true);
    listCredentials()
      .then((list) => {
        const active = list.filter((c) => c.status === 'ACTIVE');
        setCredentials(active);
        setCredentialId(active[0]?.id ?? '');
      })
      .catch(() => setCredentials([]))
      .finally(() => setLoadingCredentials(false));
  }, [open]);

  return (
    <RemoteCommandModal
      open={open}
      onClose={onClose}
      commandType="REMOTE_START"
      title="Iniciar carga remota"
      contextLines={[
        { label: 'Sitio', value: siteName },
        { label: 'Estación', value: stationName },
        { label: 'EVSE', value: evseName },
        { label: 'Conector', value: connectorLabel },
      ]}
      confirmQuestion="¿Iniciar carga remota en este conector?"
      warningText="MOVOS enviará la solicitud al cargador. Un vehículo debe estar físicamente conectado para que la carga realmente comience."
      confirmDisabled={loadingCredentials || !credentialId}
      confirmDisabledReason={
        !loadingCredentials && credentials.length === 0
          ? 'No hay credenciales de autorización activas en esta organización.'
          : undefined
      }
      onConfirm={() => requestRemoteStart(connectorId, credentialId)}
    >
      <div className="space-y-1.5">
        <label
          htmlFor="remote-start-credential"
          className="text-sm font-medium"
        >
          Credencial de autorización
        </label>
        <select
          id="remote-start-credential"
          value={credentialId}
          onChange={(e) => setCredentialId(e.target.value)}
          disabled={loadingCredentials || credentials.length === 0}
          className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingCredentials && <option>Cargando credenciales…</option>}
          {!loadingCredentials && credentials.length === 0 && (
            <option value="">Sin credenciales disponibles</option>
          )}
          {credentials.map((credential) => (
            <option key={credential.id} value={credential.id}>
              {credential.type} · {credential.externalIdentifier}
            </option>
          ))}
        </select>
      </div>
    </RemoteCommandModal>
  );
}
