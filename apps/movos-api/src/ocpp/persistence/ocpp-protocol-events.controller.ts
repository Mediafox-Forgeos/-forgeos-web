import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Membership } from '@prisma/client';

import { OcppProtocolEventService } from './ocpp-protocol-event.service';
import { ListOcppEventsQueryDto } from './dto/list-ocpp-events-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../../guards/org-context.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { OrgContext } from '../../common/decorators/org-context.decorator';
import { toApiOcppProtocolEvent } from '../../auth/presenters';

/**
 * WO-ARGOS-091 — the minimum secure, read-only OCPP support surface: "El
 * cargador no funciona" should be answerable inside MOVOS, without DB or
 * Railway shell access. Read-only by construction — no POST/PATCH/DELETE
 * on this controller, ever (no replay, no resend, no mutation).
 *
 * No @Roles() restriction, deliberately matching the two closest existing
 * precedents for this exact resource family: GET /charging-stations/:id
 * and GET /authorization-attempts both already have no role restriction
 * beyond authenticated org membership — reads are broadly available in
 * this codebase, only mutations are role-gated. Inventing a stricter,
 * bespoke policy here (e.g. excluding VIEWER/ANALYST) would be a guess,
 * not a decision grounded in this codebase's existing MemberRole policy.
 */
@ApiTags('ocpp-protocol-events')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller()
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class OcppProtocolEventsController {
  constructor(private readonly events: OcppProtocolEventService) {}

  @Get('charging-stations/:stationId/ocpp-events')
  @ApiOperation({
    summary: 'Recent OCPP protocol activity for a charging station',
  })
  async listForStation(
    @OrgContext() membership: Membership,
    @Param('stationId') stationId: string,
    @Query() query: ListOcppEventsQueryDto,
  ) {
    const { events, hasMore } = await this.events.listForStation(
      membership.organizationId,
      stationId,
      {
        limit: query.limit,
        before: query.before ? new Date(query.before) : undefined,
        action: query.action,
        direction: query.direction,
      },
    );
    return { events: events.map(toApiOcppProtocolEvent), hasMore };
  }
}
