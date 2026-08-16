import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkOrderPriority } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// Deliberately narrower than WorkOrderSource — CONNECTIVITY_LOSS is only
// ever created by WorkOrderAutomationService (Rule 1), never directly by
// an operator through this endpoint. See work-order.service.ts's create().
const OPERATOR_CREATABLE_SOURCES = ['RECOMMENDATION', 'MANUAL'] as const;

export class CreateWorkOrderDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ enum: WorkOrderPriority })
  @IsEnum(WorkOrderPriority)
  priority!: WorkOrderPriority;

  @ApiProperty({ enum: OPERATOR_CREATABLE_SOURCES })
  @IsIn(OPERATOR_CREATABLE_SOURCES)
  source!: (typeof OPERATOR_CREATABLE_SOURCES)[number];

  @ApiProperty()
  @IsString()
  stationId!: string;

  @ApiPropertyOptional({
    description: 'WO-ARGOS-049 — optional planned field visit, ISO 8601.',
  })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
