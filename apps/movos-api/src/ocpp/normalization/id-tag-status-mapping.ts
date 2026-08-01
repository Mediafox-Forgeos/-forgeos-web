import type { AuthAttemptResult } from '@prisma/client';

/**
 * Maps MOVOS's AuthAttemptResult onto OCPP 1.6J's idTagInfo.status
 * vocabulary (Accepted | Blocked | Expired | Invalid | ConcurrentTx).
 * Shared by AuthorizationHandler and TransactionStartHandler — both build
 * a CALLRESULT carrying idTagInfo, so both need the same mapping. MOVOS
 * has no distinct REVOKED bucket in OCPP's vocabulary; Blocked is the
 * closest fit (both mean "this idTag is deliberately not usable," as
 * opposed to Expired/Invalid's more passive non-events).
 */
export function idTagStatusFor(result: AuthAttemptResult): string {
  switch (result) {
    case 'ACCEPTED':
    case 'OFFLINE_ACCEPTED':
      return 'Accepted';
    case 'REVOKED':
    case 'REJECTED':
      return 'Blocked';
    case 'EXPIRED':
      return 'Expired';
    case 'UNKNOWN':
    default:
      return 'Invalid';
  }
}
