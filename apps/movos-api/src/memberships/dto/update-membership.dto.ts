import { ApiPropertyOptional } from '@nestjs/swagger';
import { MemberRole, MemberStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

/** WO-ARGOS-089 — role change and/or status change (deactivate/reactivate)
 * on one existing membership. At least one field is required — enforced in
 * MembershipsService, not here, since "neither field present" is a
 * business-rule question, not a shape question. */
export class UpdateMembershipDto {
  @ApiPropertyOptional({ enum: MemberRole })
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @ApiPropertyOptional({ enum: MemberStatus })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;
}
