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
  template: `
    @let _cartCount = cartCount();
    @let _status = status();
    @let _statusLabel = statusLabel();
    @let _statusHint = statusHint();
    @let _user = user();
    @let _authStatus = authStatus();
    @let _isAdmin = isAdmin();

    <mat-toolbar class="toolbar">
      <a class="brand"
          routerLink="/menu">
        <mat-icon aria-hidden="true">restaurant</mat-icon>
        <span class="brand-name">Trattoria</span>
      </a>
      <nav class="nav"
          aria-label="Main">
        <a mat-button
            routerLink="/menu"
            routerLinkActive="active">
          <span [matBadge]="_cartCount || null"
              [matBadgeDescription]="_cartCount + ' items in cart'"
              matBadgeOverlap="false">Menu</span>
        </a>
        @if (_user) {
          <a mat-button
              routerLink="/orders"
              routerLinkActive="active">{{ _isAdmin ? 'Orders' : 'My orders' }}</a>
        }
        @if (_isAdmin) {
          <a mat-button
              routerLink="/setup"
              routerLinkActive="active">Setup</a>
          <a mat-button
              routerLink="/promos"
              routerLinkActive="active">Promos</a>
        }
      </nav>
      <span class="status"
          role="status"
          [class]="'status status-' + _status"
          [matTooltip]="_statusHint">
        <span class="dot"
            aria-hidden="true"></span>
        <span class="status-label">{{ _statusLabel }}</span>
      </span>
      @if (_user) {
        <button class="account"
            type="button"
            [attr.aria-label]="'Account: ' + _user.name"
            mat-icon-button
            [matMenuTriggerFor]="accountMenu">
          <mat-icon>account_circle</mat-icon>
        </button>
        <mat-menu #accountMenu="matMenu">
          <div class="account-info">
            <div class="account-name">{{ _user.name }}</div>
            <div class="account-email">{{ _user.email }}</div>
          </div>
          <button type="button"
              (click)="logout()"
              mat-menu-item>
            <mat-icon>logout</mat-icon>
            Sign out
          </button>
        </mat-menu>
      } @else if (_authStatus === 'anonymous') {
        <a mat-stroked-button
            routerLink="/login">Sign in</a>
      }
    </mat-toolbar>

    @if (_status !== 'online' && _status !== 'connecting') {
      <div class="banner"
          role="alert">
        {{ _statusHint }}
      </div>
    }

    <main class="content">
      <router-outlet />
    </main>
  `,
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
