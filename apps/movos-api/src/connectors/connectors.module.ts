import { Module } from '@nestjs/common';

import { ConnectorsService } from './connectors.service';
import { ConnectorsController } from './connectors.controller';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

@Module({
  controllers: [ConnectorsController],
  providers: [ConnectorsService, OrgContextGuard, RolesGuard],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
