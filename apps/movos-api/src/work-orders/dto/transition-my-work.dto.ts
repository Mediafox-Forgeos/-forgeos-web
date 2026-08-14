import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

const MY_WORK_TRANSITIONS = ['start', 'comment', 'resolve'] as const;

export class TransitionMyWorkDto {
  @ApiProperty({ enum: MY_WORK_TRANSITIONS })
  @IsEnum(MY_WORK_TRANSITIONS)
  transition!: (typeof MY_WORK_TRANSITIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
