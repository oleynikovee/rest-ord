import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/auth.decorators.js';
import { APP_CONFIG, type AppConfig, type ClientConfig } from '../config.js';

/** Runtime configuration for the browser app, so one built image works in every environment. */
@Controller('config')
@Public()
@SkipThrottle()
export class ConfigController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  get(): ClientConfig {
    return this.config.client;
  }
}
