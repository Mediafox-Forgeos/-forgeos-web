/**
 * WO-ARGOS-064 §20 — honest, state-specific operator language. ACCEPTED
 * must never read as "started"/"stopped" — that's exactly the distinction
 * REMOTE_COMMAND_ACCEPTED_IS_NOT_REAL_WORLD_CONFIRMATION exists to protect.
 * Keep this the single place these strings live — never inline a
 * command-state message anywhere else.
 */

export type RemoteCommandUiState =
  | 'REQUESTED'
  | 'SENT'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'TIMED_OUT'
  | 'UNCONFIRMED';

const START_MESSAGES: Record<RemoteCommandUiState, string> = {
  REQUESTED: 'Enviando solicitud…',
  SENT: 'Enviando solicitud…',
  ACCEPTED: 'Solicitud aceptada por el cargador. Esperando inicio de carga.',
  CONFIRMED: 'Carga iniciada.',
  REJECTED: 'El cargador rechazó la solicitud.',
  TIMED_OUT: 'El cargador no respondió a tiempo.',
  UNCONFIRMED:
    'El cargador aceptó la solicitud, pero MOVOS no confirmó el inicio de la carga.',
};

const STOP_MESSAGES: Record<RemoteCommandUiState, string> = {
  REQUESTED: 'Enviando solicitud de detención…',
  SENT: 'Enviando solicitud de detención…',
  ACCEPTED: 'Solicitud aceptada. Esperando confirmación de cierre.',
  CONFIRMED: 'Sesión finalizada.',
  REJECTED: 'El cargador rechazó la solicitud de detención.',
  TIMED_OUT: 'El cargador no respondió a tiempo.',
  UNCONFIRMED:
    'El cargador aceptó la solicitud, pero MOVOS no confirmó el cierre de la sesión.',
};

export function remoteCommandMessage(
  commandType: 'REMOTE_START' | 'REMOTE_STOP',
  state: string,
): string {
  const table = commandType === 'REMOTE_START' ? START_MESSAGES : STOP_MESSAGES;
  return table[state as RemoteCommandUiState] ?? state;
}

/** Terminal states — polling stops once one of these is reached. */
export const TERMINAL_REMOTE_COMMAND_STATES = new Set([
  'CONFIRMED',
  'REJECTED',
  'TIMED_OUT',
  'UNCONFIRMED',
]);

export function isSuccessState(state: string): boolean {
  return state === 'CONFIRMED';
}

export function isFailureState(state: string): boolean {
  return (
    state === 'REJECTED' || state === 'TIMED_OUT' || state === 'UNCONFIRMED'
  );
}
