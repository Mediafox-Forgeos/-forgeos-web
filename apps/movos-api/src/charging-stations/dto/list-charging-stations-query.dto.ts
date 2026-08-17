import { ApiPropertyOptional } from '@nestjs/swagger';
import { ChargingStationStatus, ConnectivityStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListChargingStationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ enum: ChargingStationStatus })
  @IsOptional()
  @IsEnum(ChargingStationStatus)
  status?: ChargingStationStatus;

  @ApiPropertyOptional({ enum: ConnectivityStatus })
  @IsOptional()
  @IsEnum(ConnectivityStatus)
  connectivityStatus?: ConnectivityStatus;
}
