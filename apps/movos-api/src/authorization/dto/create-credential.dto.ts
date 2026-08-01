import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthCredentialType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCredentialDto {
  @ApiProperty({ enum: AuthCredentialType })
  @IsEnum(AuthCredentialType)
  type!: AuthCredentialType;

  @ApiProperty({
    example: '04A2B3C4',
    description:
      'The physical/protocol-facing identifier (e.g. an RFID UID) — never the primary key',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  externalIdentifier!: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
