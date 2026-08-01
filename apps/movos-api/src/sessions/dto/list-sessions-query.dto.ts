import { ApiPropertyOptional } from '@nestjs/swagger';
import { ChargingSessionStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListSessionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chargingStationId?: string;

  @ApiPropertyOptional({ enum: ChargingSessionStatus })
  @IsOptional()
  @IsEnum(ChargingSessionStatus)
  status?: ChargingSessionStatus;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
