import { Module } from '@nestjs/common';

import { EvsesService } from './evses.service';
import { EvsesController } from './evses.controller';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

@Module({
  controllers: [EvsesController],
  providers: [EvsesService, OrgContextGuard, RolesGuard],
  exports: [EvsesService],
})
export class EvsesModule {}
