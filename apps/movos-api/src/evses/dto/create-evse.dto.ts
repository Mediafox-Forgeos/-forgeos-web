import { ApiPropertyOptional } from '@nestjs/swagger';
import { CurrentType, EvseStatus, PhaseType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEvseDto {
  @ApiPropertyOptional({
    example: '1',
    description:
      'Protocol/hardware identifier (e.g. an OCPP evseId) — not the primary key',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  externalId?: string;

  @ApiPropertyOptional({ example: 'EVSE 1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: EvseStatus })
  @IsOptional()
  @IsEnum(EvseStatus)
  status?: EvseStatus;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxPowerKw?: number;

  @ApiPropertyOptional({ enum: CurrentType })
  @IsOptional()
  @IsEnum(CurrentType)
  currentType?: CurrentType;

  @ApiPropertyOptional({ enum: PhaseType })
  @IsOptional()
  @IsEnum(PhaseType)
  phaseType?: PhaseType;
}
