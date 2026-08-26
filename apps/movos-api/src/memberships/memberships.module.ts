import { Module } from '@nestjs/common';

import { MembershipsService } from './memberships.service';
import { MembershipsController } from './memberships.controller';
import { MembershipInvitationsService } from './membership-invitations.service';
import { MembershipInvitationsController } from './membership-invitations.controller';
import { PublicInvitationsController } from './public-invitations.controller';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

/** WO-ARGOS-089 — organization member management + one-time invitation
 * links for people with no MOVOS account yet. */
@Module({
  controllers: [
    MembershipsController,
    MembershipInvitationsController,
    PublicInvitationsController,
  ],
  providers: [
    OrgContextGuard,
    RolesGuard,
    MembershipsService,
    MembershipInvitationsService,
  ],
})
export class MembershipsModule {}
