import { ApiProperty } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';

/** WO-ARGOS-089 — invites a person who does not yet have a MOVOS account. */
export class CreateInvitationDto {
  @ApiProperty({ example: 'nueva.persona@kylumenergy.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: MemberRole })
  @IsEnum(MemberRole)
  role!: MemberRole;
}
