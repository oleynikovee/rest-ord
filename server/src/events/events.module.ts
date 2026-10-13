import { Module } from '@nestjs/common';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { OutboxRelay } from './outbox-relay.js';

@Module({
  controllers: [EventsController],
  providers: [EventsService, OutboxRelay],
})
export class EventsModule {}
