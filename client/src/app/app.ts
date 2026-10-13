import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectCartCount } from './store/cart/cart.selectors';
import { connectionFeature } from './store/connection/connection.reducer';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatTooltipModule,
  ],
  template: `
    <mat-toolbar class="toolbar">
      <a class="brand" routerLink="/menu">
        <mat-icon aria-hidden="true">restaurant</mat-icon>
        <span class="brand-name">Trattoria</span>
      </a>
      <nav class="nav" aria-label="Main">
        <a mat-button routerLink="/menu" routerLinkActive="active">
          <span [matBadge]="cartCount() || null" [matBadgeDescription]="cartCount() + ' items in cart'" matBadgeOverlap="false">Menu</span>
        </a>
        <a mat-button routerLink="/orders" routerLinkActive="active">Orders</a>
        <a mat-button routerLink="/setup" routerLinkActive="active">Setup</a>
      </nav>
      <span
        class="status"
        [class]="'status status-' + status()"
        role="status"
        [matTooltip]="statusHint()"
      >
        <span class="dot" aria-hidden="true"></span>
        <span class="status-label">{{ statusLabel() }}</span>
      </span>
    </mat-toolbar>

    @if (status() !== 'online' && status() !== 'connecting') {
      <div class="banner" role="alert">
        {{ statusHint() }}
      </div>
    }

    <main class="content">
      <router-outlet />
    </main>
  `,
  styleUrl: './app.scss',
})
export class App {
  private readonly store = inject(Store);

  protected readonly cartCount = this.store.selectSignal(selectCartCount);
  protected readonly status = this.store.selectSignal(connectionFeature.selectStatus);

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
}
