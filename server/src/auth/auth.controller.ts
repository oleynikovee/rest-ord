import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: User }> {
    const user = await this.auth.login(dto.email, dto.password);
    await this.startSession(user, req, res);
    return { user };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: User }> {
    const user = await this.auth.register(dto.email, dto.name, dto.password);
    await this.startSession(user, req, res);
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions(req));
  }

  private async startSession(
    user: User,
    req: Request,
    res: Response,
  ): Promise<void> {
    const token = await this.auth.issueToken(user);
    res.cookie(SESSION_COOKIE, token, {
      ...this.cookieOptions(req),
      maxAge: this.config.auth.sessionTtlSeconds * 1000,
    });
  }

  /**
   * httpOnly: scripts cannot read the token (XSS). SameSite=Strict: the browser does not
   * send it with cross-site requests, which protects the cookie-authenticated API from CSRF.
   */
  private cookieOptions(req: Request): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      // Over HTTPS (directly or via the trusted proxy) the cookie is never sent in clear text.
      secure: this.config.auth.cookieSecure || req.secure,
      path: '/',
    };
  }
}
