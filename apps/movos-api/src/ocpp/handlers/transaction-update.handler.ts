import { Injectable, Logger } from '@nestjs/common';
import type { ChargingStation } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { MeterValuesService } from '../../sessions/meter-values.service';
import type {
  DomainResult,
  MeterSample,
  NormalizedInboundEvent,
} from '../protocol/common/normalized-events';

const WH_PER_KWH = 1000;

function normalizeToWh(sample: MeterSample): number {
  return sample.unit === 'kWh' ? sample.value * WH_PER_KWH : sample.value;
}

function normalizeToW(sample: MeterSample): number {
  return sample.unit === 'kW' ? sample.value * 1000 : sample.value;
}

/**
 * OCPP MeterValues (transaction-scoped) — appends one MeterValue row per
 * message via MeterValuesService, which also keeps ChargingSession.energyWh
 * current. Non-transaction-scoped MeterValues never reach this handler —
 * the adapter already resolves those to UnsupportedMessage. See
 * docs/domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md §9/§14.
 */
@Injectable()
export class TransactionUpdateHandler {
  private readonly logger = new Logger(TransactionUpdateHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meterValues: MeterValuesService,
  ) {}

  async handle(
    event: Extract<NormalizedInboundEvent, { type: 'TransactionUpdate' }>,
    station: ChargingStation,
  ): Promise<DomainResult> {
    const session = await this.prisma.chargingSession.findFirst({
      where: {
        chargingStationId: station.id,
        protocolTransactionId: event.transactionRef,
      },
    });

    if (!session) {
      this.logger.warn(
        `MeterValues for unknown transactionRef=${event.transactionRef} on station ${station.id}`,
      );
      // "telemetry loss must never invalidate a session" — there is no
      // session to invalidate here in the first place, but the connection
      // itself must not be penalized for a device reporting on a
      // transaction MOVOS doesn't (or no longer) recognizes.
      return { status: 'Rejected' };
    }

    const energySample = event.values.find(
      (v) => v.measurand === 'Energy.Active.Import.Register',
    );
    if (!energySample) {
      // Valid telemetry (e.g. instantaneous voltage/current only) with
      // nothing energy-related to persist as MeterValue.energyWh is
      // required — accepted as a no-op, not an error.
      return { status: 'Accepted' };
    }

    const powerSample = event.values.find(
      (v) => v.measurand === 'Power.Active.Import',
    );
    const voltageSample = event.values.find((v) => v.measurand === 'Voltage');
    const currentSample = event.values.find(
      (v) => v.measurand === 'Current.Import',
    );
    const frequencySample = event.values.find(
      (v) => v.measurand === 'Frequency',
    );
    const temperatureSample = event.values.find(
      (v) => v.measurand === 'Temperature',
    );

    const recorded = await this.meterValues.record({
      sessionId: session.id,
      timestamp: new Date(event.timestamp),
      energyWh: Math.round(normalizeToWh(energySample)),
      powerW: powerSample ? Math.round(normalizeToW(powerSample)) : undefined,
      voltage: voltageSample?.value,
      current: currentSample?.value,
      frequency: frequencySample?.value,
      temperature: temperatureSample?.value,
    });

    // recorded is null only when the sample was non-monotonic — still an
    // accepted OCPP message (MeterValues.conf carries no payload either
    // way), the sample was just dropped, not the connection penalized.
    void recorded;
    return { status: 'Accepted' };
  }
}
