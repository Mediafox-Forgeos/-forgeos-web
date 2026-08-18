import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, RemoteCommandState, RemoteCommandType } from '@prisma/client';
import type {
  AuthorizationCredential,
  ChargingSession,
  ChargingStation,
  Connector,
  RemoteCommand,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ConnectionRegistryService } from '../connection-registry/connection-registry.service';
import {
  PendingCallRegistryService,
  type PendingCallResolution,
} from '../outbound/pending-call-registry.service';
import { Ocpp16Adapter } from '../protocol/ocpp16/ocpp16-adapter';
import { Ocpp201Adapter } from '../protocol/ocpp201/ocpp201-adapter';
import { formatCall } from '../protocol/common/ocpp-frame';
import { CapabilityNotSupportedError } from '../protocol/common/errors';
import type {
  NormalizedOutboundCommand,
  OcppProtocolVersion,
  ProtocolAdapter,
} from '../protocol/common/normalized-events';
import {
  assertRemoteCommandTransitionAllowed,
  NON_TERMINAL_REMOTE_COMMAND_STATES,
} from './remote-command-state-machine';

export interface RequestRemoteCommandInput {
  organizationId: string;
  actorUserId: string;
  chargingStationId: string;
  commandType: RemoteCommandType;
  /** RemoteStart, UnlockConnector. */
  connectorId?: string;
  /** RemoteStop. */
  chargingSessionId?: string;
  /** RemoteStart only — WO-058 Decision: an existing real
   * AuthorizationCredential the operator selects, never a synthetic
   * operator-initiated credential. */
  authorizationCredentialId?: string;
}

export const DEFAULT_REMOTE_COMMAND_RESPONSE_TIMEOUT_MS = 30_000;
/** Injection token so tests can override the response-wait window (e.g.
 * the Digital Twin foundation validation spec's timeout scenarios) without
 * actually waiting out the real production timeout. Optional — every real
 * wiring (ocpp.module.ts) omits it and gets the real default. */
export const REMOTE_COMMAND_RESPONSE_TIMEOUT_MS =
  'REMOTE_COMMAND_RESPONSE_TIMEOUT_MS';

/**
 * WO-ARGOS-059 — Remote Operations / Control Plane Foundation. The single
 * orchestrator for the operator-intent -> transport -> protocol
 * acknowledgement -> real-world outcome pipeline WO-056/058 requires kept
 * separate. No controller/HTTP endpoint exists yet on top of this in this
 * work order — "do not expose Remote Operations to production operators."
 *
 * Ownership order matters throughout this class: tenant ownership is
 * verified via a real DB read (the getOwned* helpers below, the same
 * relation-filter pattern used everywhere else in this codebase) BEFORE
 * anything else — including before a RemoteCommand row is ever created for
 * a station outside the caller's organization, and before the live OCPP
 * connection is ever resolved (WO-058 Decision: "never trust an
 * ocppIdentity, station ID or connector ID supplied by the caller without
 * tenant-scoped resolution").
 */
@Injectable()
export class RemoteCommandService {
  private readonly logger = new Logger(RemoteCommandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly connectionRegistry: ConnectionRegistryService,
    private readonly pendingCalls: PendingCallRegistryService,
    private readonly ocpp16Adapter: Ocpp16Adapter,
    private readonly ocpp201Adapter: Ocpp201Adapter,
    @Optional()
    @Inject(REMOTE_COMMAND_RESPONSE_TIMEOUT_MS)
    private readonly responseTimeoutMs: number = DEFAULT_REMOTE_COMMAND_RESPONSE_TIMEOUT_MS,
  ) {}

  async requestCommand(
    input: RequestRemoteCommandInput,
  ): Promise<RemoteCommand> {
    // 1. Tenant ownership + existence — before anything else exists. A
    // station/connector/session outside the caller's organization is
    // indistinguishable from one that doesn't exist (NotFoundException,
    // same convention as getOwnedChargingStation/ConnectorsService.getById
    // throughout this codebase) — no RemoteCommand row is ever created for
    // it.
    const station = await this.getOwnedStation(
      input.organizationId,
      input.chargingStationId,
    );

    let connector: Connector | null = null;
    if (input.connectorId) {
      connector = await this.getOwnedConnector(
        input.organizationId,
        input.chargingStationId,
        input.connectorId,
      );
    }

    let session: ChargingSession | null = null;
    if (input.chargingSessionId) {
      session = await this.getOwnedSession(
        input.organizationId,
        input.chargingStationId,
        input.chargingSessionId,
      );
      // A RemoteStop always targets a specific connector — resolve it from
      // the session so the concurrency guard and persisted RemoteCommand
      // row are consistent with every connector-scoped command, not a
      // special case.
      connector ??= await this.prisma.connector.findUnique({
        where: { id: session.connectorId },
      });
    }

    let credential: AuthorizationCredential | null = null;
    if (input.commandType === RemoteCommandType.REMOTE_START) {
      if (!connector) {
        throw new BadRequestException('RemoteStart requiere un connectorId.');
      }
      if (!input.authorizationCredentialId) {
        throw new BadRequestException(
          'RemoteStart requiere authorizationCredentialId (WO-058: se usa una credencial real existente, no una sintética).',
        );
      }
      credential = await this.getOwnedActiveCredential(
        input.organizationId,
        input.authorizationCredentialId,
      );
    }

    if (input.commandType === RemoteCommandType.REMOTE_STOP && !session) {
      throw new BadRequestException('RemoteStop requiere chargingSessionId.');
    }

    // 2. Concurrency guard (scope item 8) — application-level check first
    // (a clean, immediate ConflictException); the partial unique index
    // RemoteCommand_one_active_per_connector is the true race-safe
    // backstop (create-then-catch-P2002, same pattern as
    // BillingAccount_one_system_default_per_org).
    await this.assertNoConflictingCommand(
      input.chargingStationId,
      connector?.id ?? null,
    );

    // 3. Create the REQUESTED row. From here on, every outcome — including
    // every guardrail rejection below — is a real, persisted, audited
    // RemoteCommand, not a silent failure.
    let command: RemoteCommand;
    try {
      command = await this.prisma.remoteCommand.create({
        data: {
          organizationId: input.organizationId,
          chargingStationId: input.chargingStationId,
          connectorId: connector?.id ?? null,
          chargingSessionId: session?.id ?? null,
          commandType: input.commandType,
          state: RemoteCommandState.REQUESTED,
          requestedByUserId: input.actorUserId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya hay un comando remoto en curso para este objetivo.',
        );
      }
      throw error;
    }

    await this.recordAudit(
      'REMOTE_COMMAND_REQUESTED',
      command,
      input.actorUserId,
    );

    // 4. Resolve the live connection. WO-058 Decision: offline/unknown
    // stations fail immediately — no queue, no retry.
    const ocppIdentity = station.ocppIdentity;
    const connectionRecord = ocppIdentity
      ? this.connectionRegistry.get(ocppIdentity)
      : undefined;
    if (!connectionRecord) {
      return this.rejectBeforeSend(
        command,
        input.actorUserId,
        'La estación no está en línea.',
      );
    }

    // 5. Build the outbound frame via the protocol adapter — the only
    // seam for raw OCPP vocabulary (normalized-events.ts). A command type
    // the connected protocol version doesn't implement (Reset/
    // UnlockConnector/ChangeAvailability, or anything over 2.0.1) rejects
    // the same way an offline station does, not a 500.
    const adapter = this.adapterFor(connectionRecord.protocolVersion);
    const normalizedCommand = this.buildNormalizedCommand(
      input.commandType,
      // A live connectionRecord can only exist if ocppIdentity was truthy
      // (it's how we just looked it up above).
      ocppIdentity as string,
      connector,
      session,
      credential,
    );

    let framePayload: Record<string, unknown>;
    let actionName: string;
    try {
      framePayload = adapter.formatOutbound(normalizedCommand).raw as Record<
        string,
        unknown
      >;
      actionName = adapter.outboundActionName(normalizedCommand.type);
    } catch (error) {
      if (error instanceof CapabilityNotSupportedError) {
        return this.rejectBeforeSend(
          command,
          input.actorUserId,
          `${input.commandType} no está soportado por el protocolo de esta estación (${connectionRecord.protocolVersion}).`,
        );
      }
      throw error;
    }

    // 6. Send — register the pending call BEFORE sending, so a response
    // that arrives immediately can never race ahead of registration.
    const messageId = randomUUID();
    const callFrame = formatCall(messageId, actionName, framePayload);

    const outcome = await new Promise<
      | { kind: 'response'; resolution: PendingCallResolution }
      | { kind: 'timeout' }
    >((resolve) => {
      this.pendingCalls.register(
        messageId,
        ocppIdentity as string,
        {
          resolve: (resolution) => resolve({ kind: 'response', resolution }),
          onTimeout: () => resolve({ kind: 'timeout' }),
        },
        this.responseTimeoutMs,
      );

      const sent = this.connectionRegistry.send(
        ocppIdentity as string,
        callFrame,
      );
      if (!sent) {
        // Race: the connection dropped between step 4's check and this
        // send. Deliberately not resolved here — the already-registered
        // pending call will resolve honestly via its own timeout (WO-058
        // Decision: "must eventually resolve honestly — normally
        // TIMED_OUT" — never a special-cased instant failure that bypasses
        // the same state machine every other outcome goes through).
        this.logger.warn(
          `RemoteCommand ${command.id}: connection for ${ocppIdentity} disappeared between resolution and send — awaiting timeout`,
        );
      }
    });

    command = await this.transitionAndPersist(
      command,
      RemoteCommandState.SENT,
      {
        sentAt: new Date(),
        protocolMessageId: messageId,
        requestPayload: framePayload as Prisma.InputJsonValue,
      },
    );
    await this.recordAudit('REMOTE_COMMAND_SENT', command, input.actorUserId, {
      messageId,
      action: actionName,
    });

    if (outcome.kind === 'timeout') {
      return this.finalize(
        command,
        RemoteCommandState.TIMED_OUT,
        input.actorUserId,
        'REMOTE_COMMAND_TIMED_OUT',
        { rejectionReason: 'No se recibió respuesta del cargador a tiempo.' },
      );
    }

    const { resolution } = outcome;
    if (resolution.kind === 'CALLERROR') {
      return this.finalize(
        command,
        RemoteCommandState.REJECTED,
        input.actorUserId,
        'REMOTE_COMMAND_REJECTED',
        {
          responsePayload: {
            errorCode: resolution.errorCode,
            errorDescription: resolution.errorDescription,
            details: resolution.details,
          } as Prisma.InputJsonValue,
          rejectionReason: `${resolution.errorCode}: ${resolution.errorDescription}`,
        },
      );
    }

    // CALLRESULT — interpreted through the SAME protocol seam, never a raw
    // payload.status read here. Accepted means only "the charger will
    // attempt it" (WO-058 Decision) — this is protocol acceptance, not
    // physical outcome confirmation. This foundation stops here; real
    // corroboration (ACCEPTED -> CONFIRMED/UNCONFIRMED) is wired by a
    // future work order exposing an actual command to production — see
    // confirmCommand/markUnconfirmed below, which exist and are tested at
    // the state-machine level but are not called from anywhere yet.
    const { accepted } = adapter.parseOutboundResult(
      normalizedCommand,
      resolution.payload,
    );

    if (accepted) {
      return this.finalize(
        command,
        RemoteCommandState.ACCEPTED,
        input.actorUserId,
        'REMOTE_COMMAND_ACCEPTED',
        { responsePayload: resolution.payload as Prisma.InputJsonValue },
        /* terminal */ false,
      );
    }
    return this.finalize(
      command,
      RemoteCommandState.REJECTED,
      input.actorUserId,
      'REMOTE_COMMAND_REJECTED',
      {
        responsePayload: resolution.payload as Prisma.InputJsonValue,
        rejectionReason: 'El cargador rechazó el comando (status: Rejected).',
      },
    );
  }

  /** ACCEPTED -> CONFIRMED. Reserved for a future work order's
   * domain-specific corroboration (e.g. an inbound StartTransaction
   * confirming a RemoteStart) — see the state machine's own doc comment.
   * Not called by anything in WO-059 itself. */
  async confirmCommand(id: string): Promise<RemoteCommand> {
    const command = await this.requireCommand(id);
    return this.finalize(
      command,
      RemoteCommandState.CONFIRMED,
      command.requestedByUserId,
      'REMOTE_COMMAND_CONFIRMED',
      {},
    );
  }

  /** ACCEPTED -> UNCONFIRMED. Same reservation as confirmCommand. */
  async markUnconfirmed(id: string, reason: string): Promise<RemoteCommand> {
    const command = await this.requireCommand(id);
    return this.finalize(
      command,
      RemoteCommandState.UNCONFIRMED,
      command.requestedByUserId,
      'REMOTE_COMMAND_UNCONFIRMED',
      { rejectionReason: reason },
    );
  }

  private async rejectBeforeSend(
    command: RemoteCommand,
    actorUserId: string,
    reason: string,
  ): Promise<RemoteCommand> {
    return this.finalize(
      command,
      RemoteCommandState.REJECTED,
      actorUserId,
      'REMOTE_COMMAND_REJECTED',
      { rejectionReason: reason },
    );
  }

  private async finalize(
    command: RemoteCommand,
    targetState: RemoteCommandState,
    actorUserId: string,
    auditAction: string,
    data: Prisma.RemoteCommandUpdateInput,
    terminal = true,
  ): Promise<RemoteCommand> {
    const updated = await this.transitionAndPersist(command, targetState, {
      ...data,
      ...(terminal ? { resolvedAt: new Date() } : {}),
    });
    await this.recordAudit(auditAction, updated, actorUserId);
    return updated;
  }

  private async transitionAndPersist(
    command: RemoteCommand,
    targetState: RemoteCommandState,
    data: Prisma.RemoteCommandUpdateInput,
  ): Promise<RemoteCommand> {
    assertRemoteCommandTransitionAllowed(command.state, targetState);
    return this.prisma.remoteCommand.update({
      where: { id: command.id },
      data: { ...data, state: targetState },
    });
  }

  private async recordAudit(
    action: string,
    command: RemoteCommand,
    actorUserId: string,
    extraMetadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.audit.record({
      action,
      organizationId: command.organizationId,
      actorUserId,
      subjectType: 'RemoteCommand',
      subjectId: command.id,
      metadata: {
        commandType: command.commandType,
        chargingStationId: command.chargingStationId,
        connectorId: command.connectorId,
        chargingSessionId: command.chargingSessionId,
        state: command.state,
        ...extraMetadata,
      } as Prisma.InputJsonValue,
    });
  }

  private async assertNoConflictingCommand(
    chargingStationId: string,
    connectorId: string | null,
  ): Promise<void> {
    const conflicting = await this.prisma.remoteCommand.findFirst({
      where: {
        chargingStationId,
        state: { in: NON_TERMINAL_REMOTE_COMMAND_STATES },
        ...(connectorId
          ? { OR: [{ connectorId: null }, { connectorId }] }
          : {}),
      },
    });
    if (conflicting) {
      throw new ConflictException(
        'Ya hay un comando remoto en curso para este objetivo.',
      );
    }
  }

  private buildNormalizedCommand(
    commandType: RemoteCommandType,
    stationIdentity: string,
    connector: Connector | null,
    session: ChargingSession | null,
    credential: AuthorizationCredential | null,
  ): NormalizedOutboundCommand {
    switch (commandType) {
      case RemoteCommandType.REMOTE_START:
        return {
          type: 'RemoteStart',
          stationIdentity,
          connectorExternalId: connector?.externalId ?? '',
          idTag: credential?.externalIdentifier ?? '',
        };
      case RemoteCommandType.REMOTE_STOP:
        return {
          type: 'RemoteStop',
          stationIdentity,
          transactionRef: session?.protocolTransactionId ?? '',
        };
      case RemoteCommandType.RESET:
        return { type: 'Reset', stationIdentity, mode: 'Soft' };
      case RemoteCommandType.UNLOCK_CONNECTOR:
        return {
          type: 'UnlockConnector',
          stationIdentity,
          connectorExternalId: connector?.externalId ?? '',
        };
      case RemoteCommandType.CHANGE_AVAILABILITY:
        return {
          type: 'ChangeAvailability',
          stationIdentity,
          connectorExternalId: connector?.externalId ?? undefined,
          availability: 'Operative',
        };
    }
  }

  private adapterFor(version: OcppProtocolVersion): ProtocolAdapter {
    return version === 'OCPP1_6J' ? this.ocpp16Adapter : this.ocpp201Adapter;
  }

  private async requireCommand(id: string): Promise<RemoteCommand> {
    const command = await this.prisma.remoteCommand.findUnique({
      where: { id },
    });
    if (!command) {
      throw new NotFoundException(`RemoteCommand ${id} no encontrado`);
    }
    return command;
  }

  /** Ownership walks the full chain (station -> site -> organization), same
   * pattern as every other service in this codebase. */
  private async getOwnedStation(
    organizationId: string,
    chargingStationId: string,
  ): Promise<ChargingStation> {
    const station = await this.prisma.chargingStation.findFirst({
      where: { id: chargingStationId, site: { organizationId } },
    });
    if (!station) {
      throw new NotFoundException('Estación de carga no encontrada');
    }
    return station;
  }

  private async getOwnedConnector(
    organizationId: string,
    chargingStationId: string,
    connectorId: string,
  ): Promise<Connector> {
    const connector = await this.prisma.connector.findFirst({
      where: {
        id: connectorId,
        evse: {
          chargingStationId,
          chargingStation: { site: { organizationId } },
        },
      },
    });
    if (!connector) {
      throw new NotFoundException('Conector no encontrado');
    }
    return connector;
  }

  private async getOwnedSession(
    organizationId: string,
    chargingStationId: string,
    chargingSessionId: string,
  ): Promise<ChargingSession> {
    const session = await this.prisma.chargingSession.findFirst({
      where: { id: chargingSessionId, organizationId, chargingStationId },
    });
    if (!session) {
      throw new NotFoundException('Sesión de carga no encontrada');
    }
    return session;
  }

  private async getOwnedActiveCredential(
    organizationId: string,
    authorizationCredentialId: string,
  ): Promise<AuthorizationCredential> {
    const credential = await this.prisma.authorizationCredential.findFirst({
      where: { id: authorizationCredentialId, organizationId },
    });
    if (!credential) {
      throw new NotFoundException('Credencial de autorización no encontrada');
    }
    if (credential.status !== 'ACTIVE') {
      throw new BadRequestException(
        'La credencial de autorización no está activa.',
      );
    }
    return credential;
  }
}
