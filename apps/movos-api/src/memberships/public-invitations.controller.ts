import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { MembershipInvitationsService } from './membership-invitations.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

/**
 * WO-ARGOS-089 — fully public, unauthenticated. Authorization is the
 * possession of a valid one-time token in the URL itself, exactly like
 * POST /auth/refresh's httpOnly-cookie-only authorization — no JwtAuthGuard,
 * no OrgContextGuard, no organizationId/role ever read from the request
 * body. Deliberately its own controller (not folded into
 * MembershipInvitationsController) so a guard added there in the future can
 * never accidentally apply here.
 */
@ApiTags('invitations')
@Controller('invitations')
export class PublicInvitationsController {
  constructor(private readonly invitations: MembershipInvitationsService) {}

  @Get(':token')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Preview an invitation before accepting it (public)',
  })
  async preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  // Same reasoning as POST /auth/login's throttle — this is a
  // credential-adjacent public surface (token guessing), not ordinary API
  // traffic.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Accept an invitation and create the account (public)',
  })
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.invitations.accept(token, dto);
  }
}
