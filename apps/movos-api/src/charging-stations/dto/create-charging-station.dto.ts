import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChargingStationStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateChargingStationDto {
  @ApiProperty({ example: 'Estación Bogotá Centro 01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: 'BOG-CTR-01',
    description: 'Human-readable business code, unique within the Site',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @ApiPropertyOptional({ example: 'Kempower' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'Satellite 400' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiPropertyOptional({ example: 'KMP-400-0001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @ApiPropertyOptional({
    example: 'OCPP 1.6J',
    description: 'Free-form protocol/version string, not an enum',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  protocol?: string;

  @ApiPropertyOptional({ enum: ChargingStationStatus })
  @IsOptional()
  @IsEnum(ChargingStationStatus)
  status?: ChargingStationStatus;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  commissionedAt?: string;
}
