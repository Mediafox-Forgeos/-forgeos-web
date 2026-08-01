import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Membership } from '@prisma/client';

import { SessionsService } from './sessions.service';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { toApiChargingSession, toApiMeterValue } from '../auth/presenters';

@ApiTags('sessions')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller('sessions')
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List charging sessions for the active organization',
  })
  async list(
    @OrgContext() membership: Membership,
    @Query() query: ListSessionsQueryDto,
  ) {
    const sessions = await this.sessions.list(membership.organizationId, query);
    return sessions.map(toApiChargingSession);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a charging session by id' })
  async getById(@OrgContext() membership: Membership, @Param('id') id: string) {
    const session = await this.sessions.getById(membership.organizationId, id);
    return toApiChargingSession(session);
  }

  @Get(':id/meter-values')
  @ApiOperation({
    summary: 'List meter-value telemetry for a charging session',
  })
  async listMeterValues(
    @OrgContext() membership: Membership,
    @Param('id') id: string,
  ) {
    const meterValues = await this.sessions.listMeterValues(
      membership.organizationId,
      id,
    );
    return meterValues.map(toApiMeterValue);
  }
}
