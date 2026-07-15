import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * The refresh token is normally read from the httpOnly cookie. This optional
 * body field exists only to support non-browser clients.
 */
export class RefreshDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
