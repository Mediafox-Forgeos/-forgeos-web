import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberRole, type Membership } from '@prisma/client';

import { EvsesService } from './evses.service';
import { CreateEvseDto } from './dto/create-evse.dto';
import { UpdateEvseDto } from './dto/update-evse.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { toApiEvse } from '../auth/presenters';
import type { AuthenticatedUser } from '../common/request-context';

@ApiTags('evses')
@Controller()
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class EvsesController {
  constructor(private readonly evses: EvsesService) {}

  @Get('charging-stations/:chargingStationId/evses')
  @ApiOperation({ summary: 'List EVSEs for a charging station' })
  async listByChargingStation(
    @OrgContext() membership: Membership,
    @Param('chargingStationId') chargingStationId: string,
  ) {
    const evses = await this.evses.listByChargingStation(
      membership.organizationId,
      chargingStationId,
    );
    return evses.map(toApiEvse);
  }

  @Post('charging-stations/:chargingStationId/evses')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an EVSE (OWNER or ADMIN)' })
  async create(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('chargingStationId') chargingStationId: string,
    @Body() dto: CreateEvseDto,
  ) {
    const evse = await this.evses.create(
      membership.organizationId,
      chargingStationId,
      user.id,
      dto,
    );
    return toApiEvse(evse);
  }

  @Get('evses/:id')
  @ApiOperation({ summary: 'Get an EVSE by id' })
  async getById(@OrgContext() membership: Membership, @Param('id') id: string) {
    const evse = await this.evses.getById(membership.organizationId, id);
    return toApiEvse(evse);
  }

  @Patch('evses/:id')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN, MemberRole.OPERATOR)
  @ApiOperation({ summary: 'Update an EVSE (OWNER, ADMIN or OPERATOR)' })
  async update(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEvseDto,
  ) {
    const evse = await this.evses.update(
      membership.organizationId,
      user.id,
      id,
      dto,
    );
    return toApiEvse(evse);
  }
}
