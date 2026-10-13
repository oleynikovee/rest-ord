import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from './store/auth/auth.actions';
import { authFeature } from './store/auth/auth.reducer';
import { selectCartCount } from './store/cart/cart.selectors';
import { connectionFeature } from './store/connection/connection.reducer';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
})
export class App {
  private readonly store = inject(Store);

  protected readonly cartCount = this.store.selectSignal(selectCartCount);
  protected readonly status = this.store.selectSignal(connectionFeature.selectStatus);
  protected readonly user = this.store.selectSignal(authFeature.selectUser);
  protected readonly authStatus = this.store.selectSignal(authFeature.selectStatus);
  protected readonly isAdmin = this.store.selectSignal(authFeature.selectIsAdmin);

  protected readonly statusLabel = computed(
    () =>
      ({
        connecting: 'Connecting…',
        online: 'Live',
        reconnecting: 'Reconnecting…',
        offline: 'Offline',
      })[this.status()],
  );

  protected readonly statusHint = computed(() => {
    switch (this.status()) {
      case 'online':
        return 'Menu, prices and order statuses update in real time.';
      case 'offline':
        return 'You are offline. You can keep browsing; prices and availability are re-checked before your order is placed.';
      default:
        return 'Live updates are paused while we reconnect. Prices and availability are re-checked before your order is placed.';
    }
  });

  protected logout(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
