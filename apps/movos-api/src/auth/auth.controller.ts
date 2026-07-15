import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { AuthService, type IssuedRefresh } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { SelectOrgDto } from '../organizations/dto/select-org.dto';
import type {
  AuthenticatedUser,
  RequestWithContext,
} from '../common/request-context';
import { toApiOrganization, toApiUser, toApiMembership } from './presenters';

const REFRESH_COOKIE = 'movos_refresh';
const SESSION_COOKIE = 'movos_session';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  async login(
    @Body() _dto: LoginDto,
    @CurrentUser() principal: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(principal, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    this.setRefreshCookies(res, result.refresh);

    return {
      accessToken: result.accessToken,
      user: toApiUser(result.user),
      organizations: result.organizations.map(toApiOrganization),
      memberships: result.memberships.map(toApiMembership),
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  async refresh(
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = this.readRefreshCookie(req);
    const result = await this.authService.refresh(presented, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    this.setRefreshCookies(res, result.refresh);

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = this.readRefreshCookie(req);
    await this.authService.logout(user.id, presented);
    this.clearRefreshCookies(res);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Return the current user, organizations and roles' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.authService.getProfile(user.id);
    return {
      user: toApiUser(profile.user),
      organizations: profile.organizations.map(toApiOrganization),
      memberships: profile.memberships.map(toApiMembership),
    };
  }

  @Post('select-organization')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue an access token scoped to an organization' })
  async selectOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SelectOrgDto,
  ) {
    const result = await this.authService.selectOrganization(
      user.id,
      dto.organizationId,
    );
    return {
      accessToken: result.accessToken,
      organizationId: result.organizationId,
    };
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    const fromCookie = cookies?.[REFRESH_COOKIE];
    if (fromCookie) {
      return fromCookie;
    }
    const body = req.body as { refreshToken?: string } | undefined;
    return body?.refreshToken;
  }

  private setRefreshCookies(res: Response, refresh: IssuedRefresh): void {
    const secure = this.isProduction();
    const maxAge = refresh.expiresAt.getTime() - Date.now();

    // sameSite: 'none' is required for cross-domain deployments (API on
    // railway.app, frontend on vercel.app). Requires secure: true.
    res.cookie(REFRESH_COOKIE, refresh.token, {
      httpOnly: true,
      sameSite: 'none',
      secure,
      path: '/',
      maxAge,
    });

    res.cookie(SESSION_COOKIE, '1', {
      httpOnly: false,
      sameSite: 'none',
      secure,
      path: '/',
      maxAge,
    });
  }

  private clearRefreshCookies(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
