import { randomBytes } from 'node:crypto';
import { Global, Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        let secret = config.auth.jwtSecret;
        if (!secret) {
          secret = randomBytes(32).toString('hex');
          new Logger('Auth').warn('JWT_SECRET is not set: using a random secret, sessions end on restart.');
        }
        return { secret, signOptions: { expiresIn: config.auth.sessionTtlSeconds } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
