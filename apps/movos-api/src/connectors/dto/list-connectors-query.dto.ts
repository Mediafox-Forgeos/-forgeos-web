import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConnectorStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListConnectorsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chargingStationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evseId?: string;

  @ApiPropertyOptional({ enum: ConnectorStatus })
  @IsOptional()
  @IsEnum(ConnectorStatus)
  status?: ConnectorStatus;
}
