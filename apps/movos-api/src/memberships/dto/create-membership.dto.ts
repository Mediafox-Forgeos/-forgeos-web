import { ApiProperty } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';

/**
 * WO-ARGOS-089 — adds an EXISTING MOVOS user (by email) to the active
 * organization. Deliberately does not support creating a brand-new User —
 * see MembershipsService.create's doc comment for why that's a separate,
 * not-yet-authorized decision.
 */
export class CreateMembershipDto {
  @ApiProperty({ example: 'operador@kylumenergy.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: MemberRole })
  @IsEnum(MemberRole)
  role!: MemberRole;
}
