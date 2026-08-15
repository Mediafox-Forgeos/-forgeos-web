import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

const TRANSITIONS = [
  'assign',
  'start',
  'comment',
  'resolve',
  'cancel',
] as const;

export class TransitionWorkOrderDto {
  @ApiProperty({ enum: TRANSITIONS })
  @IsEnum(TRANSITIONS)
  transition!: (typeof TRANSITIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedMemberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
