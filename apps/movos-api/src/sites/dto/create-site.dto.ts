import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SiteStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSiteDto {
  @ApiProperty({ example: 'Estación Bogotá Centro' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Bogotá' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @ApiProperty({ example: 'Cra 7 # 32-16' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  address!: string;

  @ApiPropertyOptional({ example: 4.6097 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -74.0817 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ enum: SiteStatus })
  @IsOptional()
  @IsEnum(SiteStatus)
  status?: SiteStatus;
}
