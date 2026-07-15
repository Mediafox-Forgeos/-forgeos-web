import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '../../common/request-context';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await this.authService.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    return user;
  }
}
