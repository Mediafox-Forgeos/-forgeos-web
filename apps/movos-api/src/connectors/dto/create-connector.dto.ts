import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConnectorStatus, ConnectorType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateConnectorDto {
  @ApiPropertyOptional({
    example: '1',
    description:
      'Protocol/hardware identifier (e.g. an OCPP connectorId) — not the primary key',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  externalId?: string;

  @ApiProperty({ enum: ConnectorType })
  @IsEnum(ConnectorType)
  type!: ConnectorType;

  @ApiPropertyOptional({ enum: ConnectorStatus })
  @IsOptional()
  @IsEnum(ConnectorStatus)
  status?: ConnectorStatus;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxPowerKw?: number;
}
