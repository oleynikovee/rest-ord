import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { CurrentUser, Public } from '../auth/auth.decorators.js';
import type { EventsPage, User } from '../domain/models.js';
import { EventsService } from './events.service.js';

class EventsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after: number;
}

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** Public: anonymous visitors get menu events, signed-in users also their order events. */
  @Get()
  @Public()
  page(
    @CurrentUser() user: User | undefined,
    @Query() query: EventsQueryDto,
  ): Promise<EventsPage> {
    return this.events.page(user, query.after);
  }
}
