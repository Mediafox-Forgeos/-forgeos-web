import { Injectable } from '@nestjs/common';

/**
 * Mints protocolTransactionId values for new ChargingSessions. OCPP 1.6J's
 * StartTransaction is a request FROM the device with no transaction
 * identifier attached — the CSMS (MOVOS) assigns transactionId and returns
 * it in StartTransaction.conf. See CAP-004_CHARGING_SESSIONS_FOUNDATION.md
 * §5 for why this is an in-memory, per-process counter rather than a
 * database sequence: it reuses the same single-instance MVP constraint
 * CAP-003's ConnectionRegistryService already depends on (Decision 6), not
 * a new one. Wrapped to stay within the 32-bit signed integer range some
 * real charge-point firmware expects for OCPP 1.6J's integer transactionId.
 */
@Injectable()
export class TransactionIdGeneratorService {
  private counter: number;

  constructor() {
    this.counter = Date.now() % 100_000;
  }

  next(): string {
    this.counter = (this.counter + 1) % 0x7fffffff;
    return String(this.counter);
  }
}
