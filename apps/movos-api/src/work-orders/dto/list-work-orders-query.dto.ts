import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkOrderPriority, WorkOrderStatus } from '@prisma/client';
import {
  IsBooleanString,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';

// WO-ARGOS-051 — Operations Console. Every field here is a truthful filter
// over an already-real WorkOrder column (no new data) — see
// docs/operations (WO_ARGOS_051_DISCOVERY_REPORT) for why status was the
// only filter this DTO supported before now.
export class ListWorkOrdersQueryDto {
  @ApiPropertyOptional({ enum: WorkOrderStatus })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;

  @ApiPropertyOptional({ enum: WorkOrderPriority })
  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;

  @ApiPropertyOptional({ description: 'Filter to a specific assignee' })
  @IsOptional()
  @IsString()
  assignedMemberId?: string;

  // 'true' means assignedMemberId IS NULL — takes precedence over
  // assignedMemberId above if both are somehow present.
  @ApiPropertyOptional({ description: 'true = only unassigned work orders' })
  @IsOptional()
  @IsBooleanString()
  unassigned?: string;

  @ApiPropertyOptional({
    description: 'Inclusive lower bound for scheduledAt, ISO 8601',
  })
  @IsOptional()
  @IsISO8601()
  scheduledFrom?: string;

  @ApiPropertyOptional({
    description: 'Exclusive upper bound for scheduledAt, ISO 8601',
  })
  @IsOptional()
  @IsISO8601()
  scheduledTo?: string;
}
