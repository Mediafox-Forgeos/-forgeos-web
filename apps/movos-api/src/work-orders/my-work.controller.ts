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

import { MyWorkService } from './my-work.service';
import { TransitionMyWorkDto } from './dto/transition-my-work.dto';
import { RecordChecklistEventDto } from './dto/record-checklist-event.dto';
import { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/request-context';
import { toApiWorkOrder, toApiWorkOrderEvent } from '../auth/presenters';

/**
 * Technician Identity & My Work (WO-ARGOS-037). The complete backend
 * surface for a field technician — deliberately separate from
 * WorkOrderController, not an extra role branch inside it, so the
 * self-scoping (`assignedMemberId = self`) is structural rather than a
 * conditional an operator-facing route could someday drift out of.
 *
 * No @Roles() restriction: identity derives from the authenticated JWT +
 * the ACTIVE Membership OrgContextGuard already re-validates server-side
 * on every request, and every query below additionally filters on
 * assignedMemberId — so any authenticated organization member can see
 * their own assigned work, exactly as safely as a TECHNICIAN can, and
 * never anyone else's. See docs/operations/FIELD_TECHNICIAN_CONSOLE.md.
 */
@ApiTags('my-work')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller('my-work')
@UseGuards(JwtAuthGuard, OrgContextGuard)
export class MyWorkController {
  constructor(private readonly myWork: MyWorkService) {}

  @Get()
  @ApiOperation({ summary: 'List work orders assigned to the current user' })
  async list(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWorkOrdersQueryDto,
  ) {
    const workOrders = await this.myWork.list(
      membership.organizationId,
      user.id,
      query.status,
    );
    return workOrders.map(toApiWorkOrder);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a work order assigned to the current user' })
  async getById(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const workOrder = await this.myWork.getOwnWorkOrder(
      membership.organizationId,
      user.id,
      id,
    );
    return toApiWorkOrder(workOrder);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'List the event timeline for a work order' })
  async listEvents(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const events = await this.myWork.listEvents(
      membership.organizationId,
      user.id,
      id,
    );
    return events.map(toApiWorkOrderEvent);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Start, comment on, or resolve an assigned work order',
  })
  async transition(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionMyWorkDto,
  ) {
    const workOrder = await this.myWork.transition(
      membership.organizationId,
      user.id,
      id,
      dto.transition,
      dto.comment,
    );
    return toApiWorkOrder(workOrder);
  }

  @Post(':id/checklist-events')
  @ApiOperation({ summary: 'Record a field checklist stage' })
  async recordChecklistEvent(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecordChecklistEventDto,
  ) {
    const event = await this.myWork.recordChecklistEvent(
      membership.organizationId,
      user.id,
      id,
      dto,
    );
    return toApiWorkOrderEvent(event);
  }
}
