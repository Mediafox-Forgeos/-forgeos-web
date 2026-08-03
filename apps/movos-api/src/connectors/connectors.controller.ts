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

import { ConnectorsService } from './connectors.service';
import { CreateConnectorDto } from './dto/create-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { toApiConnector } from '../auth/presenters';
import type { AuthenticatedUser } from '../common/request-context';

@ApiTags('connectors')
@Controller()
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class ConnectorsController {
  constructor(private readonly connectors: ConnectorsService) {}

  @Get('evses/:evseId/connectors')
  @ApiOperation({ summary: 'List connectors for an EVSE' })
  async listByEvse(
    @OrgContext() membership: Membership,
    @Param('evseId') evseId: string,
  ) {
    const connectors = await this.connectors.listByEvse(
      membership.organizationId,
      evseId,
    );
    return connectors.map(toApiConnector);
  }

  @Post('evses/:evseId/connectors')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a connector (OWNER or ADMIN)' })
  async create(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('evseId') evseId: string,
    @Body() dto: CreateConnectorDto,
  ) {
    const connector = await this.connectors.create(
      membership.organizationId,
      evseId,
      user.id,
      dto,
    );
    return toApiConnector(connector);
  }

  @Get('connectors/:id')
  @ApiOperation({ summary: 'Get a connector by id' })
  async getById(@OrgContext() membership: Membership, @Param('id') id: string) {
    const connector = await this.connectors.getById(
      membership.organizationId,
      id,
    );
    return toApiConnector(connector);
  }

  @Patch('connectors/:id')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN, MemberRole.OPERATOR)
  @ApiOperation({ summary: 'Update a connector (OWNER, ADMIN or OPERATOR)' })
  async update(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateConnectorDto,
  ) {
    const connector = await this.connectors.update(
      membership.organizationId,
      user.id,
      id,
      dto,
    );
    return toApiConnector(connector);
  }
}
