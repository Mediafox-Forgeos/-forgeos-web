import { Module } from '@nestjs/common';

import { MembershipsService } from './memberships.service';
import { MembershipsController } from './memberships.controller';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

/** WO-ARGOS-089 — organization member management. */
@Module({
  controllers: [MembershipsController],
  providers: [OrgContextGuard, RolesGuard, MembershipsService],
})
export class MembershipsModule {}
