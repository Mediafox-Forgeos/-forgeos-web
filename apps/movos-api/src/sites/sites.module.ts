import { Module } from '@nestjs/common';

import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

@Module({
  controllers: [SitesController],
  providers: [SitesService, OrgContextGuard, RolesGuard],
  exports: [SitesService],
})
export class SitesModule {}
