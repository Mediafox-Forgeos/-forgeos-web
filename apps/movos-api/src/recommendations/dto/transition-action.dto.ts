import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const TRANSITIONS = [
  'acknowledge',
  'assign',
  'snooze',
  'resolve',
  'dismiss',
] as const;

export class TransitionActionDto {
  @ApiProperty({ enum: TRANSITIONS })
  @IsEnum(TRANSITIONS)
  transition!: (typeof TRANSITIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 7 * 24 * 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7 * 24 * 60)
  snoozeMinutes?: number;
}
