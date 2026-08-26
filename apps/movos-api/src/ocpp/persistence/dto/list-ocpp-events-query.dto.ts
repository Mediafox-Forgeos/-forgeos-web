import { ApiPropertyOptional } from '@nestjs/swagger';
import { OcppMessageDirection } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  OCPP_EVENTS_DEFAULT_LIMIT,
  OCPP_EVENTS_MAX_LIMIT,
} from '../ocpp-protocol-event.service';

// WO-ARGOS-091 — every field here is a truthful filter over an
// already-persisted OcppProtocolEvent column (no new data). `before` is a
// simple ISO-8601 upper bound (matches ListWorkOrdersQueryDto's
// scheduledFrom/scheduledTo convention), not a cursor token — deliberately
// the simplest thing that supports "load older events" without overbuilding
// pagination, per this WO's own instruction.
export class ListOcppEventsQueryDto {
  @ApiPropertyOptional({
    default: OCPP_EVENTS_DEFAULT_LIMIT,
    maximum: OCPP_EVENTS_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(OCPP_EVENTS_MAX_LIMIT)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Only events received strictly before this instant, ISO 8601',
  })
  @IsOptional()
  @IsISO8601()
  before?: string;

  @ApiPropertyOptional({
    description: 'Exact OCPP action name, e.g. BootNotification',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ enum: OcppMessageDirection })
  @IsOptional()
  @IsEnum(OcppMessageDirection)
  direction?: OcppMessageDirection;
}
