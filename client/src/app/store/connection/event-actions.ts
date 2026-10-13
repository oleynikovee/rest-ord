import type { Action } from '@ngrx/store';
import { type EventEnvelope, TOPICS } from '../../core/models';
import { MenuLiveActions } from '../menu/menu.actions';
import { OrdersActions } from '../orders/orders.actions';
import { ConnectionActions } from './connection.actions';

export function envelopeToActions(envelope: EventEnvelope): Action[] {
  return [toAction(envelope), ConnectionActions.seqAdvanced({ seq: envelope.seq })];
}

function toAction(envelope: EventEnvelope): Action {
  if (envelope.topic === TOPICS.orders) {
    return OrdersActions.orderUpserted({ order: envelope.event.order });
  }
  const event = envelope.event;
  switch (event.type) {
    case 'category.upserted':
      return MenuLiveActions.categoryUpserted({ category: event.category });
    case 'category.deleted':
      return MenuLiveActions.categoryDeleted({ id: event.id });
    case 'item.upserted':
      return MenuLiveActions.itemUpserted({ item: event.item });
    case 'item.deleted':
      return MenuLiveActions.itemDeleted({ id: event.id });
  }
}
