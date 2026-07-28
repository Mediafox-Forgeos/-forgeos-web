import { Module } from '@nestjs/common';

import { ChargingStationsService } from './charging-stations.service';
import { ChargingStationsController } from './charging-stations.controller';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

@Module({
  controllers: [ChargingStationsController],
  providers: [ChargingStationsService, OrgContextGuard, RolesGuard],
  exports: [ChargingStationsService],
})
export class ChargingStationsModule {}
