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

import { ChargingStationsService } from './charging-stations.service';
import { CreateChargingStationDto } from './dto/create-charging-station.dto';
import { UpdateChargingStationDto } from './dto/update-charging-station.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { toApiChargingStation } from '../auth/presenters';
import type { AuthenticatedUser } from '../common/request-context';

@ApiTags('charging-stations')
@Controller()
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class ChargingStationsController {
  constructor(private readonly chargingStations: ChargingStationsService) {}

  @Get('sites/:siteId/charging-stations')
  @ApiOperation({ summary: 'List charging stations for a site' })
  async listBySite(
    @OrgContext() membership: Membership,
    @Param('siteId') siteId: string,
  ) {
    const stations = await this.chargingStations.listBySite(
      membership.organizationId,
      siteId,
    );
    return stations.map(toApiChargingStation);
  }

  @Post('sites/:siteId/charging-stations')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a charging station (OWNER or ADMIN)' })
  async create(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('siteId') siteId: string,
    @Body() dto: CreateChargingStationDto,
  ) {
    const station = await this.chargingStations.create(
      membership.organizationId,
      siteId,
      user.id,
      dto,
    );
    return toApiChargingStation(station);
  }

  @Get('charging-stations/:id')
  @ApiOperation({ summary: 'Get a charging station by id' })
  async getById(@OrgContext() membership: Membership, @Param('id') id: string) {
    const station = await this.chargingStations.getById(
      membership.organizationId,
      id,
    );
    return toApiChargingStation(station);
  }

  @Patch('charging-stations/:id')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN, MemberRole.OPERATOR)
  @ApiOperation({
    summary: 'Update a charging station (OWNER, ADMIN or OPERATOR)',
  })
  async update(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateChargingStationDto,
  ) {
    const station = await this.chargingStations.update(
      membership.organizationId,
      user.id,
      id,
      dto,
    );
    return toApiChargingStation(station);
  }
}
