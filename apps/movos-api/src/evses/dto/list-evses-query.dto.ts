import { ApiPropertyOptional } from '@nestjs/swagger';
import { EvseStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListEvsesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chargingStationId?: string;

  @ApiPropertyOptional({ enum: EvseStatus })
  @IsOptional()
  @IsEnum(EvseStatus)
  status?: EvseStatus;
}
