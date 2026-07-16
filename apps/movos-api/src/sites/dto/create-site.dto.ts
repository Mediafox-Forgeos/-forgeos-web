import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationSource, LocationValidationStatus, SiteStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
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
  @MaxLength(500)
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

  // Rich location fields — populated by the LocationPicker/Google Places flow

  @ApiPropertyOptional({ example: 'Cra 7 # 32-16, Bogotá, Cundinamarca, Colombia' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  formattedAddress?: string;

  @ApiPropertyOptional({ example: 'Cra 7 # 32-16' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Cundinamarca' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional({ example: '110111' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'CO', description: 'ISO 3166-1 alpha-2' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  googlePlaceId?: string;

  @ApiPropertyOptional({ enum: LocationSource })
  @IsOptional()
  @IsEnum(LocationSource)
  locationSource?: LocationSource;

  @ApiPropertyOptional({ enum: LocationValidationStatus })
  @IsOptional()
  @IsEnum(LocationValidationStatus)
  locationValidationStatus?: LocationValidationStatus;
}
