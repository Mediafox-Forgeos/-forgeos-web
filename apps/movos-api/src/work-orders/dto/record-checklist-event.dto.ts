import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

const CHECKLIST_EVENT_TYPES = [
  'ARRIVAL_CONFIRMED',
  'DIAGNOSIS_RECORDED',
  'INTERVENTION_RECORDED',
  'VALIDATION_RECORDED',
] as const;

// Required-per-type validation (a diagnosis needs `finding`, a validation
// needs `outcomeNote`, ...) happens in MyWorkService, not here — mirroring
// WorkOrderService's own choice to validate resolve/cancel's comment
// requirement in the service rather than with conditional DTO groups.
export class RecordChecklistEventDto {
  @ApiProperty({ enum: CHECKLIST_EVENT_TYPES })
  @IsEnum(CHECKLIST_EVENT_TYPES)
  type!: (typeof CHECKLIST_EVENT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  finding?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcomeNote?: string;
}
