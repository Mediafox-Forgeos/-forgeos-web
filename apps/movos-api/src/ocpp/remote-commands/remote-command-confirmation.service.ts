import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  RemoteCommandState,
  RemoteCommandType,
  type ChargingSession,
  type RemoteCommand,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RemoteCommandService } from './remote-command.service';

export const DEFAULT_REMOTE_COMMAND_CONFIRMATION_WINDOW_MS = 5 * 60_000;
/** Injection token so tests can override the confirmation-window wait
 * without actually waiting out the real default — same pattern as
 * REMOTE_COMMAND_RESPONSE_TIMEOUT_MS. Optional — real wiring (ocpp.module.ts)
 * omits it and gets the real default. */
export const REMOTE_COMMAND_CONFIRMATION_WINDOW_MS =
  'REMOTE_COMMAND_CONFIRMATION_WINDOW_MS';

/**
 * WO-ARGOS-064 — the observed-outcome confirmation layer WO-059 explicitly
 * reserved (RemoteCommandService.confirmCommand/markUnconfirmed existed,
 * tested at the state-machine level, but were "not called from anywhere
 * yet"). This is a *different clock* from the SENT -> ACCEPTED response
 * timeout (REMOTE_COMMAND_RESPONSE_TIMEOUT_MS, PendingCallRegistryService):
 * that one measures "did the charger answer the CALL"; this one measures
 * "did the real-world event we expect as a consequence of an Accepted
 * command actually happen."
 *
 * Two independent ways a command gets resolved, whichever comes first:
 *  1. An *observed* domain event (a real inbound StartTransaction/
 *     StopTransaction, via onStartTransactionObserved/
 *     onStopTransactionObserved) — called by TransactionStartHandler/
 *     TransactionEndHandler for every real session-lifecycle event, not
 *     just ones caused by a remote command; a cheap DB lookup finds nothing
 *     and returns immediately for the organic (non-remote-triggered) case.
 *  2. The confirmation window elapsing with nothing observed
 *     (scheduleExpiry) -> UNCONFIRMED.
 *
 * Race-safe by construction: `confirm`/`expire` both go through
 * RemoteCommandService's own ACCEPTED -> {CONFIRMED,UNCONFIRMED}-only state
 * machine (assertRemoteCommandTransitionAllowed), so whichever path runs
 * second on an already-resolved command gets a caught, logged, harmless
 * InvalidRemoteCommandTransitionError instead of corrupting state.
 *
 * In-memory timer map — consistent with this codebase's existing
 * single-instance MVP constraint (PendingCallRegistryService,
 * ConnectionRegistryService, TransactionIdGeneratorService all already
 * depend on the same constraint; not a new one introduced here).
 */
@Injectable()
export class RemoteCommandConfirmationService {
  private readonly logger = new Logger(RemoteCommandConfirmationService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly remoteCommands: RemoteCommandService,
    @Optional()
    @Inject(REMOTE_COMMAND_CONFIRMATION_WINDOW_MS)
    private readonly windowMs: number = DEFAULT_REMOTE_COMMAND_CONFIRMATION_WINDOW_MS,
  ) {}

  /**
   * Called by the controller immediately after requestCommand resolves with
   * state ACCEPTED — never from inside RemoteCommandService itself, so
   * requestCommand's own return timing (resolves at ACCEPTED) is unchanged.
   * Starts the window clock and performs one immediate check, since the
   * corroborating event can legitimately race ahead of this call (e.g. a
   * fast charger sends StartTransaction before this synchronous
   * continuation runs).
   */
  registerAccepted(command: RemoteCommand): void {
    if (command.state !== RemoteCommandState.ACCEPTED) {
      return;
    }
    this.scheduleExpiry(command.id);
    this.checkImmediately(command).catch((error) => {
      this.logger.error(
        `Immediate confirmation check failed for RemoteCommand ${command.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  /** Called by TransactionStartHandler after SessionLifecycleService.
   * createSession returns, for every real StartTransaction — connector-
   * scoped, tenant-safe by construction (the RemoteCommand row itself is
   * already tenant-verified at creation time; at most one ACCEPTED
   * REMOTE_START can exist per connector per the concurrency guard, so this
   * match is never ambiguous). */
  async onStartTransactionObserved(
    chargingStationId: string,
    connectorId: string,
    session: ChargingSession,
  ): Promise<void> {
    const command = await this.prisma.remoteCommand.findFirst({
      where: {
        chargingStationId,
        connectorId,
        commandType: RemoteCommandType.REMOTE_START,
        state: RemoteCommandState.ACCEPTED,
      },
    });
    if (!command) {
      return;
    }
    await this.confirm(command.id, session.id);
  }

  /** Called by TransactionEndHandler after SessionLifecycleService.
   * stopSession returns, for every real StopTransaction. Matches by the
   * exact chargingSessionId the RemoteStop command was requested against —
   * set at request time, never inferred. */
  async onStopTransactionObserved(chargingSessionId: string): Promise<void> {
    const command = await this.prisma.remoteCommand.findFirst({
      where: {
        chargingSessionId,
        commandType: RemoteCommandType.REMOTE_STOP,
        state: RemoteCommandState.ACCEPTED,
      },
    });
    if (!command) {
      return;
    }
    await this.confirm(command.id);
  }

  /** WO-ARGOS-064 §13 — the natural-completion race: the target session may
   * already be COMPLETED (or, for RemoteStart, an ACTIVE session may already
   * exist on the connector) by the moment a command reaches ACCEPTED,
   * because the real inbound event and the outbound CALLRESULT are two
   * independent message flows with no guaranteed ordering. */
  private async checkImmediately(command: RemoteCommand): Promise<void> {
    if (
      command.commandType === RemoteCommandType.REMOTE_START &&
      command.connectorId
    ) {
      const session = await this.prisma.chargingSession.findFirst({
        where: {
          connectorId: command.connectorId,
          status: 'ACTIVE',
          startedAt: { gte: command.requestedAt },
        },
      });
      if (session) {
        await this.confirm(command.id, session.id);
      }
      return;
    }
    if (
      command.commandType === RemoteCommandType.REMOTE_STOP &&
      command.chargingSessionId
    ) {
      const session = await this.prisma.chargingSession.findUnique({
        where: { id: command.chargingSessionId },
      });
      if (session?.status === 'COMPLETED') {
        await this.confirm(command.id);
      }
    }
  }

  private async confirm(
    commandId: string,
    linkedChargingSessionId?: string,
  ): Promise<void> {
    this.clearTimer(commandId);
    try {
      await this.remoteCommands.confirmCommand(
        commandId,
        linkedChargingSessionId,
      );
    } catch (error) {
      this.logger.warn(
        `confirmCommand(${commandId}) skipped — likely already resolved by a concurrent expiry/observation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private scheduleExpiry(commandId: string): void {
    const timer = setTimeout(() => {
      this.expire(commandId).catch((error) => {
        this.logger.error(
          `Confirmation-window expiry failed for RemoteCommand ${commandId}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    }, this.windowMs);
    timer.unref?.();
    this.timers.set(commandId, timer);
  }

  private clearTimer(commandId: string): void {
    const timer = this.timers.get(commandId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(commandId);
    }
  }

  private async expire(commandId: string): Promise<void> {
    this.timers.delete(commandId);
    const command = await this.prisma.remoteCommand.findUnique({
      where: { id: commandId },
    });
    // Already resolved by an observed event that won the race — a safe,
    // expected no-op, not an error.
    if (!command || command.state !== RemoteCommandState.ACCEPTED) {
      return;
    }
    try {
      await this.remoteCommands.markUnconfirmed(
        commandId,
        'No se observó la evidencia esperada dentro de la ventana de confirmación.',
      );
    } catch (error) {
      this.logger.warn(
        `markUnconfirmed(${commandId}) skipped — likely already resolved by a concurrent observation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
