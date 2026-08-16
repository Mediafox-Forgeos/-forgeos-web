import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

// WO-ARGOS-049 — deliberately separate from TransitionWorkOrderDto:
// scheduling a visit is not a WorkOrderStatus transition.
export class SetWorkOrderScheduleDto {
  @ApiPropertyOptional({
    description: 'ISO 8601 timestamp, or omitted/null to clear the schedule.',
  })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string | null;
}
