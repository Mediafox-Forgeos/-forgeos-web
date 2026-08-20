import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MemberRole,
  RemoteCommandState,
  type Membership,
} from '@prisma/client';

import { RemoteCommandService } from './remote-command.service';
import { RemoteCommandConfirmationService } from './remote-command-confirmation.service';
import { RequestRemoteStartDto } from './dto/request-remote-start.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../../guards/org-context.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgContext } from '../../common/decorators/org-context.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { toApiRemoteCommand } from '../../auth/presenters';
import type { AuthenticatedUser } from '../../common/request-context';

/** WO-ARGOS-058 decision, reconfirmed by WO-ARGOS-064: RemoteStart and
 * RemoteStop are OWNER/ADMIN/OPERATOR only — never TECHNICIAN/SUPPORT/
 * ANALYST/VIEWER. Frontend visibility is not the security boundary; this
 * guard is. */
const REMOTE_OPERATIONS_ROLES = [
  MemberRole.OWNER,
  MemberRole.ADMIN,
  MemberRole.OPERATOR,
];

/**
 * WO-ARGOS-064 — the first operator-accessible Remote Operations surface.
 * Resource-oriented routes (a connector for RemoteStart, a session for
 * RemoteStop), never a generic "execute arbitrary OCPP command" endpoint —
 * matches this WO's explicit instruction and this codebase's existing REST
 * conventions (ConnectorsController, SessionsController).
 *
 * Every route delegates ownership verification to RemoteCommandService's
 * own tenant-scoped lookups (requestRemoteStart, requestRemoteStop, the
 * listCommandsFor helpers, getCommandById) — this controller never resolves
 * a caller-supplied id itself.
 */
@ApiTags('remote-commands')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller()
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class RemoteCommandsController {
  constructor(
    private readonly remoteCommands: RemoteCommandService,
    private readonly confirmation: RemoteCommandConfirmationService,
  ) {}

  @Post('connectors/:connectorId/remote-start')
  @Roles(...REMOTE_OPERATIONS_ROLES)
  @ApiOperation({
    summary: 'Request a RemoteStart on a connector (OWNER, ADMIN or OPERATOR)',
  })
  async remoteStart(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('connectorId') connectorId: string,
    @Body() dto: RequestRemoteStartDto,
  ) {
    const command = await this.remoteCommands.requestRemoteStart(
      membership.organizationId,
      user.id,
      connectorId,
      dto.authorizationCredentialId,
    );
    // Registered here, never inside RemoteCommandService itself — keeps
    // requestCommand's own return timing (resolves at ACCEPTED) exactly as
    // WO-059's existing tests expect, and keeps the confirmation layer an
    // additive concern on top of an already-hardened foundation.
    if (command.state === RemoteCommandState.ACCEPTED) {
      this.confirmation.registerAccepted(command);
    }
    return toApiRemoteCommand(command);
  }

  @Post('sessions/:sessionId/remote-stop')
  @Roles(...REMOTE_OPERATIONS_ROLES)
  @ApiOperation({
    summary:
      'Request a RemoteStop on a charging session (OWNER, ADMIN or OPERATOR)',
  })
  async remoteStop(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    const command = await this.remoteCommands.requestRemoteStop(
      membership.organizationId,
      user.id,
      sessionId,
    );
    if (command.state === RemoteCommandState.ACCEPTED) {
      this.confirmation.registerAccepted(command);
    }
    return toApiRemoteCommand(command);
  }

  @Get('connectors/:connectorId/remote-commands')
  @ApiOperation({
    summary: 'Recent remote-command history for a connector',
  })
  async listForConnector(
    @OrgContext() membership: Membership,
    @Param('connectorId') connectorId: string,
  ) {
    const commands = await this.remoteCommands.listCommandsForConnector(
      membership.organizationId,
      connectorId,
    );
    return commands.map(toApiRemoteCommand);
  }

  @Get('sessions/:sessionId/remote-commands')
  @ApiOperation({
    summary: 'Recent remote-command history for a charging session',
  })
  async listForSession(
    @OrgContext() membership: Membership,
    @Param('sessionId') sessionId: string,
  ) {
    const commands = await this.remoteCommands.listCommandsForSession(
      membership.organizationId,
      sessionId,
    );
    return commands.map(toApiRemoteCommand);
  }

  @Get('remote-commands/:id')
  @ApiOperation({ summary: 'Get a remote command by id' })
  async getById(@OrgContext() membership: Membership, @Param('id') id: string) {
    const command = await this.remoteCommands.getCommandById(
      membership.organizationId,
      id,
    );
    return toApiRemoteCommand(command);
  }
}
