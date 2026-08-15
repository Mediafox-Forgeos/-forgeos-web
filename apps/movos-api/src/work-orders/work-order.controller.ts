import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Membership } from '@prisma/client';

import { WorkOrderService } from './work-order.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { TransitionWorkOrderDto } from './dto/transition-work-order.dto';
import { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/request-context';
import { toApiWorkOrder, toApiWorkOrderEvent } from '../auth/presenters';

/**
 * Work Order V1 (WO-ARGOS-035). Every write goes through WorkOrderService's
 * state machine — no direct Prisma access, no transition this controller
 * doesn't already validate server-side.
 */
@ApiTags('work-orders')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller('work-orders')
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class WorkOrderController {
  constructor(private readonly workOrders: WorkOrderService) {}

  @Get()
  @ApiOperation({ summary: 'List work orders for the active organization' })
  async list(
    @OrgContext() membership: Membership,
    @Query() query: ListWorkOrdersQueryDto,
  ) {
    const workOrders = await this.workOrders.list(
      membership.organizationId,
      query.status,
    );
    return workOrders.map(toApiWorkOrder);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a work order by id' })
  async getById(@OrgContext() membership: Membership, @Param('id') id: string) {
    const workOrder = await this.workOrders.getById(
      membership.organizationId,
      id,
    );
    return toApiWorkOrder(workOrder);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'List the full event timeline for a work order' })
  async listEvents(
    @OrgContext() membership: Membership,
    @Param('id') id: string,
  ) {
    const events = await this.workOrders.listEvents(
      membership.organizationId,
      id,
    );
    return events.map(toApiWorkOrderEvent);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a work order (RECOMMENDATION or MANUAL source only)',
  })
  async create(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkOrderDto,
  ) {
    const workOrder = await this.workOrders.create(membership.organizationId, {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      source: dto.source,
      stationId: dto.stationId,
      actorId: user.id,
    });
    return toApiWorkOrder(workOrder);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Transition an existing work order' })
  async transition(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionWorkOrderDto,
  ) {
    const workOrder = await this.workOrders.transition(
      membership.organizationId,
      id,
      {
        transition: dto.transition,
        assignedMemberId: dto.assignedMemberId,
        comment: dto.comment,
        actorId: user.id,
      },
    );
    return toApiWorkOrder(workOrder);
  }
}
