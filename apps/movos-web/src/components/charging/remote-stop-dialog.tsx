'use client';

import { requestRemoteStop } from '@/lib/remote-commands-api';
import { RemoteCommandModal } from './remote-command-modal';

interface RemoteStopDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  siteName: string;
  stationName: string;
}

export function RemoteStopDialog({
  open,
  onClose,
  sessionId,
  siteName,
  stationName,
}: RemoteStopDialogProps) {
  return (
    <RemoteCommandModal
      open={open}
      onClose={onClose}
      commandType="REMOTE_STOP"
      title="Detener carga remota"
      contextLines={[
        { label: 'Sitio', value: siteName },
        { label: 'Estación', value: stationName },
        { label: 'Sesión', value: sessionId },
      ]}
      confirmQuestion="¿Detener la sesión de carga en curso?"
      warningText="Esto solicitará al cargador detener la carga del vehículo conectado. MOVOS no garantiza el efecto físico inmediato."
      onConfirm={() => requestRemoteStop(sessionId)}
    />
  );
}
