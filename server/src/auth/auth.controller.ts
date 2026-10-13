import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config.js';
import type { User } from '../domain/models.js';
import { CurrentUser, Public } from './auth.decorators.js';
import { LoginDto, RegisterDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE } from './auth.types.js';

@Controller('auth')
@Public()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Anonymous visitors get `{ user: null }` instead of a 401, so the app can start quietly. */
  @Get('me')
  me(@CurrentUser() user: User | undefined): { user: User | null } {
    return { user: user ?? null };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: User }> {
    const user = await this.auth.login(dto.email, dto.password);
    await this.startSession(user, res);
    return { user };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: User }> {
    const user = await this.auth.register(dto.email, dto.name, dto.password);
    await this.startSession(user, res);
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  private async startSession(user: User, res: Response): Promise<void> {
    const token = await this.auth.issueToken(user);
    res.cookie(SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: this.config.auth.sessionTtlSeconds * 1000,
    });
  }

  /**
   * httpOnly: scripts cannot read the token (XSS). SameSite=Strict: the browser does not
   * send it with cross-site requests, which protects the cookie-authenticated API from CSRF.
   */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.auth.cookieSecure,
      path: '/',
    };
  }
}
