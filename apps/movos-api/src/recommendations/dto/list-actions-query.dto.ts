import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActionStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListActionsQueryDto {
  @ApiPropertyOptional({ enum: ActionStatus })
  @IsOptional()
  @IsEnum(ActionStatus)
  status?: ActionStatus;
}
