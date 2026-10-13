import type { EnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import * as authEffects from './auth/auth.effects';
import { authFeature } from './auth/auth.reducer';
import * as cartEffects from './cart/cart.effects';
import { cartFeature } from './cart/cart.reducer';
import * as connectionEffects from './connection/connection.effects';
import { connectionFeature } from './connection/connection.reducer';
import * as menuEffects from './menu/menu.effects';
import { menuFeature } from './menu/menu.reducer';
import * as ordersEffects from './orders/orders.effects';
import { ordersFeature } from './orders/orders.reducer';

export function provideAppStore(): EnvironmentProviders[] {
  return [
    provideStore(
      {
        [authFeature.name]: authFeature.reducer,
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
    provideEffects(authEffects, menuEffects, cartEffects, ordersEffects, connectionEffects),
  ];
}
