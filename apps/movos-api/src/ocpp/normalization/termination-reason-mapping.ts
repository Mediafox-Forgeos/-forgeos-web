import type { ChargingSessionTerminationReason } from '@prisma/client';

/**
 * OCPP 1.6J StopTransaction.reason -> ChargingSessionTerminationReason.
 * A deliberate, lossy simplification — see CAP-004_CHARGING_SESSIONS_
 * FOUNDATION.md §6 for the full mapping table and rationale for each
 * collapsed/ambiguous case. The raw `reason` string is never discarded:
 * it is preserved verbatim in the corresponding OcppProtocolEvent.payload
 * row regardless of how it's classified here.
 */
export function mapStopReasonToTerminationReason(
  reason: string | undefined,
): ChargingSessionTerminationReason {
  if (!reason) return 'NORMAL_COMPLETION';

  switch (reason) {
    case 'Local':
      return 'USER_CANCELLED';
    case 'EmergencyStop':
      return 'EMERGENCY_STOP';
    case 'EVDisconnected':
      return 'CABLE_DISCONNECTED';
    case 'HardReset':
    case 'Reboot':
    case 'SoftReset':
      return 'STATION_REBOOT';
    case 'PowerLoss':
      return 'POWER_LOSS';
    case 'Remote':
      return 'REMOTE_STOP';
    case 'UnlockCommand':
      return 'USER_CANCELLED';
    case 'Other':
    case 'DeAuthorized':
    default:
      return 'UNKNOWN';
  }
}
