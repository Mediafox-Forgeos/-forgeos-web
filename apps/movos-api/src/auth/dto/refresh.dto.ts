import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

/**
 * The refresh token is normally read from the httpOnly cookie. The
 * `refreshToken` body field exists only to support non-browser clients.
 *
 * `organizationId` (DEC-022, WO-ARGOS-015) is the organization the
 * presenting browser tab currently has active, re-validated fresh against
 * Membership exactly like `select-organization` — see
 * `AuthService.refresh`'s doc comment. Optional: a caller with no
 * established organization yet simply omits it, preserving the prior
 * no-`orgId` refresh behavior.
 */
export class RefreshDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  organizationId?: string;
}
