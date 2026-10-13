import { Injectable } from '@nestjs/common';
import {
  EVENTS_PAGE_SIZE,
  type EventEnvelope,
  type EventsPage,
  TOPICS,
  type User,
} from '../domain/models.js';
import { EventLog } from '../domain/ports.js';

export function canSee(user: User | undefined, envelope: EventEnvelope): boolean {
  if (envelope.topic === TOPICS.menu) return true;
  if (!user) return false;
  return user.role === 'admin' || envelope.event.order.userId === user.id;
}

@Injectable()
export class EventsService {
  constructor(private readonly log: EventLog) {}

  async page(user: User | undefined, after: number): Promise<EventsPage> {
    const latest = await this.log.latestSeq();
    if (after >= latest) return { events: [], nextAfter: after, hasMore: false, reset: false };

    const { events, oldestSeq } = await this.log.readAfter(after, EVENTS_PAGE_SIZE);
    if (oldestSeq === null || oldestSeq > after + 1) {
      return { events: [], nextAfter: latest, hasMore: false, reset: true };
    }
    const last = events[events.length - 1]?.seq ?? after;
    return {
      events: events.filter((event) => canSee(user, event)),
      nextAfter: last,
      hasMore: events.length === EVENTS_PAGE_SIZE,
      reset: false,
    };
  }
}
