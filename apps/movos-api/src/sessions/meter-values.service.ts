import { Injectable, Logger } from '@nestjs/common';
import type { MeterValue } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SessionLifecycleService } from './session-lifecycle.service';

export interface RecordMeterValueInput {
  sessionId: string;
  timestamp: Date;
  energyWh: number;
  powerW?: number;
  voltage?: number;
  current?: number;
  frequency?: number;
  temperature?: number;
}

/**
 * Append-only writer for MeterValue telemetry — see
 * CAP-004_CHARGING_SESSIONS_FOUNDATION.md §7. No update/delete exposed:
 * rows are write-once. Also keeps ChargingSession.energyWh current, since
 * DEC-016 requires the session's own field to be authoritative without
 * ever aggregating MeterValue rows on read.
 */
@Injectable()
export class MeterValuesService {
  private readonly logger = new Logger(MeterValuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionLifecycle: SessionLifecycleService,
  ) {}

  /** Returns null (records nothing, updates nothing) if the sample is
   * non-monotonic relative to the session's last known energyWh — "energyWh
   * progression must be monotonic" (WO-ARGOS-009). A dropped/out-of-order
   * sample is logged, never thrown: "telemetry loss must never invalidate
   * a session". */
  async record(input: RecordMeterValueInput): Promise<MeterValue | null> {
    const session = await this.prisma.chargingSession.findUnique({
      where: { id: input.sessionId },
    });
    if (!session) {
      this.logger.warn(
        `MeterValue for unknown session ${input.sessionId} dropped`,
      );
      return null;
    }

    if (input.energyWh < session.energyWh) {
      this.logger.warn(
        `Non-monotonic MeterValue for session ${input.sessionId}: ${input.energyWh}Wh < last known ${session.energyWh}Wh — sample dropped, session unaffected`,
      );
      return null;
    }

    const meterValue = await this.prisma.meterValue.create({
      data: {
        sessionId: input.sessionId,
        timestamp: input.timestamp,
        energyWh: input.energyWh,
        powerW: input.powerW,
        voltage: input.voltage,
        current: input.current,
        frequency: input.frequency,
        temperature: input.temperature,
      },
    });

    if (input.energyWh > session.energyWh) {
      await this.sessionLifecycle.updateEnergy(session.id, input.energyWh);
    }

    return meterValue;
  }
}
