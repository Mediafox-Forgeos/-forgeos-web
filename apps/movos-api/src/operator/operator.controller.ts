import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Membership } from '@prisma/client';

import { StationHealthService } from './station-health.service';
import { SiteScopeQueryDto } from './dto/site-scope-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OrgContext } from '../common/decorators/org-context.decorator';

/**
 * CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022). Read-only
 * aggregation endpoints — no write path exists on this controller, matching
 * docs/domain/CAP-X_CONTRACTS.md's boundary rule ("no method... ever writes
 * to ChargingStation, Evse, Connector, ChargingSession").
 */
@ApiTags('operator')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller('operator')
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class OperatorController {
  constructor(private readonly stationHealth: StationHealthService) {}

  @Get('fleet-status')
  @ApiOperation({
    summary: 'Station health counts (healthy/degraded/offline/unknown)',
  })
  async fleetStatus(
    @OrgContext() membership: Membership,
    @Query() query: SiteScopeQueryDto,
  ) {
    return this.stationHealth.summarizeFleet(
      membership.organizationId,
      query.siteId,
    );
  }

  @Get('connectivity')
  @ApiOperation({
    summary: 'Station connectivity counts (online/offline/unknown)',
  })
  async connectivity(
    @OrgContext() membership: Membership,
    @Query() query: SiteScopeQueryDto,
  ) {
    return this.stationHealth.summarizeConnectivity(
      membership.organizationId,
      query.siteId,
    );
  }

  @Get('map')
  @ApiOperation({
    summary: 'Per-site station health rollup, for the operational map',
  })
  async map(@OrgContext() membership: Membership) {
    return this.stationHealth.summarizeBySite(membership.organizationId);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Instantaneous connector occupancy' })
  async occupancy(
    @OrgContext() membership: Membership,
    @Query() query: SiteScopeQueryDto,
  ) {
    return this.stationHealth.getOccupancy(
      membership.organizationId,
      query.siteId,
    );
  }
}
