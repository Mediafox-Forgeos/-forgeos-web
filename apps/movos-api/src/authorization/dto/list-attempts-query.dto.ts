import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuthAttemptResult } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListAttemptsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chargingStationId?: string;

  @ApiPropertyOptional({ enum: AuthAttemptResult })
  @IsOptional()
  @IsEnum(AuthAttemptResult)
  result?: AuthAttemptResult;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
