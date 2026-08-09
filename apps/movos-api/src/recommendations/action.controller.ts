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

import { ActionService } from './action.service';
import { CreateActionDto } from './dto/create-action.dto';
import { TransitionActionDto } from './dto/transition-action.dto';
import { ListActionsQueryDto } from './dto/list-actions-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { toApiAction } from '../auth/presenters';

/**
 * Operational Execution Layer (WO-ARGOS-026). Every write here goes
 * through ActionService's state machine — no direct Prisma access, no
 * transition this controller doesn't already validate server-side (a
 * disabled button in the UI is not the enforcement mechanism).
 */
@ApiTags('actions')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller('actions')
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class ActionController {
  constructor(private readonly actions: ActionService) {}

  @Get()
  @ApiOperation({
    summary: 'List operational actions for the active organization',
  })
  async list(
    @OrgContext() membership: Membership,
    @Query() query: ListActionsQueryDto,
  ) {
    const actions = await this.actions.list(
      membership.organizationId,
      query.status,
    );
    return actions.map(toApiAction);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create (or transition an existing) Action from a live recommendation',
  })
  async create(
    @OrgContext() membership: Membership,
    @Body() dto: CreateActionDto,
  ) {
    const action = await this.actions.create(membership.organizationId, {
      recommendationType: dto.recommendationType,
      stationId: dto.stationId,
      transition: dto.transition,
      assignedToUserId: dto.assignedToUserId,
      notes: dto.notes,
      snoozeMinutes: dto.snoozeMinutes,
    });
    return toApiAction(action);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Transition an existing Action' })
  async transition(
    @OrgContext() membership: Membership,
    @Param('id') id: string,
    @Body() dto: TransitionActionDto,
  ) {
    const action = await this.actions.transition(
      membership.organizationId,
      id,
      {
        transition: dto.transition,
        assignedToUserId: dto.assignedToUserId,
        notes: dto.notes,
        snoozeMinutes: dto.snoozeMinutes,
      },
    );
    return toApiAction(action);
  }
}
