import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import * as cartEffects from './cart/cart.effects';
import { cartFeature } from './cart/cart.reducer';
import * as connectionEffects from './connection/connection.effects';
import { connectionFeature } from './connection/connection.reducer';
import * as menuEffects from './menu/menu.effects';
import { menuFeature } from './menu/menu.reducer';
import * as ordersEffects from './orders/orders.effects';
import { ordersFeature } from './orders/orders.reducer';

export function provideAppStore() {
  return [
    provideStore(
      {
        [menuFeature.name]: menuFeature.reducer,
        [cartFeature.name]: cartFeature.reducer,
        [ordersFeature.name]: ordersFeature.reducer,
        [connectionFeature.name]: connectionFeature.reducer,
      },
      {
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: true,
          strictStateSerializability: true,
          strictActionSerializability: true,
        },
      },
    ),
    provideEffects(menuEffects, cartEffects, ordersEffects, connectionEffects),
  ];
}
