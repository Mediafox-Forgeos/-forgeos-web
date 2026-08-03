import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberRole, type Membership } from '@prisma/client';

import { OcppProvisioningService } from './ocpp-provisioning.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../../guards/org-context.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgContext } from '../../common/decorators/org-context.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/request-context';

/**
 * Device provisioning/rotation/revocation — privileged (OWNER/ADMIN only,
 * matching CAP-002's create-endpoint convention). The plaintext secret
 * appears in exactly one place: the JSON response of provision()/
 * rotateSecret() below. It is never logged (NestJS's default request
 * logging does not log response bodies) and never persisted in plaintext
 * anywhere — see docs/engineering/OCPP_DEVICE_PROVISIONING_GUIDE.md.
 */
@ApiTags('ocpp-provisioning')
@Controller()
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class OcppProvisioningController {
  constructor(private readonly provisioning: OcppProvisioningService) {}

  @Post('charging-stations/:id/ocpp-provisioning')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Provision a charging station for OCPP (OWNER or ADMIN). Returns the plaintext secret exactly once.',
  })
  async provision(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') chargingStationId: string,
  ) {
    return this.provisioning.provision(
      membership.organizationId,
      user.id,
      chargingStationId,
    );
  }

  @Post('charging-stations/:id/ocpp-provisioning/rotate')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({
    summary:
      'Rotate an OCPP station secret (OWNER or ADMIN). Returns the new plaintext secret exactly once.',
  })
  async rotateSecret(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') chargingStationId: string,
  ) {
    return this.provisioning.rotateSecret(
      membership.organizationId,
      user.id,
      chargingStationId,
    );
  }

  @Post('charging-stations/:id/ocpp-provisioning/revoke')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Revoke an OCPP station credential (OWNER or ADMIN). Forcibly disconnects any live connection.',
  })
  async revoke(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') chargingStationId: string,
  ): Promise<void> {
    await this.provisioning.revoke(
      membership.organizationId,
      user.id,
      chargingStationId,
    );
  }
}
