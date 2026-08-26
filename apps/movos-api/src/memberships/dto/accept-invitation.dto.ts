import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * WO-ARGOS-089 — deliberately does NOT accept email/role/organizationId.
 * Those come exclusively from the server-side MembershipInvitation record
 * resolved by the token in the URL — the request body can never override
 * them (§10: "no organizationId or role accepted from request body as
 * authority").
 */
export class AcceptInvitationDto {
  @ApiProperty({ example: 'María Pérez' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  displayName!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password!: string;

  @ApiProperty()
  @IsString()
  passwordConfirmation!: string;
}
