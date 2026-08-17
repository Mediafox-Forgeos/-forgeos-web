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
import { MemberRole, type Membership } from '@prisma/client';

import { WorkOrderService } from './work-order.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { TransitionWorkOrderDto } from './dto/transition-work-order.dto';
import { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';
import { SetWorkOrderScheduleDto } from './dto/set-work-order-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/request-context';
import {
  toApiAssignableTechnician,
  toApiWorkOrder,
  toApiWorkOrderEvent,
  toApiWorkOrderAttachment,
  toApiTechnicianWorkload,
} from '../auth/presenters';

// WO-ARGOS-037 — every pre-existing role kept exactly the access it already
// had (this controller had no @Roles() at all before now); the one thing
// that changes is that TECHNICIAN, the new role, is never one of them.
// A technician's only path onto WorkOrder data is the self-scoped
// MyWorkController — never this fleet-wide operator surface.
const OPERATOR_FACING_ROLES = [
  MemberRole.OWNER,
  MemberRole.ADMIN,
  MemberRole.OPERATOR,
  MemberRole.SUPPORT,
  MemberRole.ANALYST,
  MemberRole.VIEWER,
] as const;

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
  @Roles(...OPERATOR_FACING_ROLES)
  @ApiOperation({ summary: 'List work orders for the active organization' })
  async list(
    @OrgContext() membership: Membership,
    @Query() query: ListWorkOrdersQueryDto,
  ) {
    const workOrders = await this.workOrders.list(membership.organizationId, {
      status: query.status,
      priority: query.priority,
      assignedMemberId: query.assignedMemberId,
      unassigned: query.unassigned === 'true',
      scheduledFrom: query.scheduledFrom
        ? new Date(query.scheduledFrom)
        : undefined,
      scheduledTo: query.scheduledTo ? new Date(query.scheduledTo) : undefined,
    });
    return workOrders.map(toApiWorkOrder);
  }

  // Declared before `:id` — a static segment must be matched first or
  // Nest/Express would treat "assignable-technicians"/"attention"/"workload"
  // as an `:id` value.
  @Get('assignable-technicians')
  @Roles(...OPERATOR_FACING_ROLES)
  @ApiOperation({
    summary: 'List ACTIVE TECHNICIAN members eligible for assignment',
  })
  async listAssignableTechnicians(@OrgContext() membership: Membership) {
    const technicians = await this.workOrders.listAssignableTechnicians(
      membership.organizationId,
    );
    return technicians.map(toApiAssignableTechnician);
  }

  // WO-ARGOS-051 — Operations Console "Requires attention." Deterministic
  // V1 rules only, evaluated once in WorkOrderService — this controller
  // never re-derives them.
  @Get('attention')
  @Roles(...OPERATOR_FACING_ROLES)
  @ApiOperation({
    summary: 'Work orders matching the deterministic V1 attention rules',
  })
  async attention(@OrgContext() membership: Membership) {
    const items = await this.workOrders.listAttentionItems(
      membership.organizationId,
    );
    return items.map((item) => ({
      workOrder: toApiWorkOrder(item.workOrder),
      reasons: item.reasons,
    }));
  }

  // WO-ARGOS-051 — Operations Console technician workload panel.
  @Get('workload')
  @Roles(...OPERATOR_FACING_ROLES)
  @ApiOperation({
    summary:
      'Per-ACTIVE-technician unresolved / in-progress / scheduled-today counts',
  })
  async workload(@OrgContext() membership: Membership) {
    const workload = await this.workOrders.getTechnicianWorkload(
      membership.organizationId,
    );
    return workload.map(toApiTechnicianWorkload);
  }

  @Get(':id')
  @Roles(...OPERATOR_FACING_ROLES)
  @ApiOperation({ summary: 'Get a work order by id' })
  async getById(@OrgContext() membership: Membership, @Param('id') id: string) {
    const workOrder = await this.workOrders.getById(
      membership.organizationId,
      id,
    );
    return toApiWorkOrder(workOrder);
  }

  @Get(':id/events')
  @Roles(...OPERATOR_FACING_ROLES)
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
  @Roles(...OPERATOR_FACING_ROLES)
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
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
    });
    return toApiWorkOrder(workOrder);
  }

  @Patch(':id')
  @Roles(...OPERATOR_FACING_ROLES)
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

  // WO-ARGOS-049 — deliberately separate from `transition()`: setting a
  // planned visit is not a WorkOrderStatus change and must not be forced
  // through TransitionWorkOrderDto/the state machine.
  @Patch(':id/schedule')
  @Roles(...OPERATOR_FACING_ROLES)
  @ApiOperation({ summary: "Set or clear a work order's planned visit" })
  async schedule(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetWorkOrderScheduleDto,
  ) {
    const workOrder = await this.workOrders.schedule(
      membership.organizationId,
      id,
      dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      user.id,
    );
    return toApiWorkOrder(workOrder);
  }

  // WO-ARGOS-049 — field evidence, read-only from the operator surface.
  // Uploading is technician-only (MyWorkController).
  @Get(':id/attachments')
  @Roles(...OPERATOR_FACING_ROLES)
  @ApiOperation({ summary: 'List field evidence attached to a work order' })
  async listAttachments(
    @OrgContext() membership: Membership,
    @Param('id') id: string,
  ) {
    const attachments = await this.workOrders.listAttachments(
      membership.organizationId,
      id,
    );
    return attachments.map(toApiWorkOrderAttachment);
  }

  @Get(':id/attachments/:attachmentId')
  @Roles(...OPERATOR_FACING_ROLES)
  @ApiOperation({
    summary:
      'Get one attachment (used by movos-web to authorize a private view URL)',
  })
  async getAttachment(
    @OrgContext() membership: Membership,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const attachment = await this.workOrders.getAttachment(
      membership.organizationId,
      id,
      attachmentId,
    );
    return toApiWorkOrderAttachment(attachment);
  }
}
