import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { ORDER_STATUSES, type OrderStatus } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';
import { OrdersActions } from '../../store/orders/orders.actions';
import { ordersFeature } from '../../store/orders/orders.reducer';

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'New',
  ACCEPTED: 'Accepted',
  COOKING: 'Cooking',
  READY: 'Ready for pickup',
  COMPLETED: 'Completed',
};

@Component({
  selector: 'app-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, MatButtonModule, MatProgressBarModule, MoneyPipe],
  template: `
    <div class="page">
      <h1>Orders</h1>

      @if (loaded()) {
        @for (order of orders(); track order.id) {
          <article class="order" [class.done]="order.status === 'COMPLETED'">
            <header>
              <h2>#{{ order.number }}</h2>
              <time [attr.datetime]="order.createdAt">{{ order.createdAt | date: 'shortTime' }}</time>
              <span class="status" [class]="'status status-' + order.status" aria-live="polite">
                {{ label(order.status) }}
              </span>
            </header>
            <mat-progress-bar
              mode="determinate"
              [value]="progress(order.status)"
              [attr.aria-label]="'Order ' + order.number + ' progress'"
            />
            <ul class="lines">
              @for (line of order.lines; track $index) {
                <li>
                  <span>{{ line.quantity }} × {{ line.name }}</span>
                  <span>{{ line.lineTotal | money }}</span>
                </li>
              }
            </ul>
            <footer>
              @if (order.discount > 0) {
                <span class="discount">Discount −{{ order.discount | money }}</span>
              }
              <strong>{{ order.total | money }}</strong>
            </footer>
          </article>
        } @empty {
          <div class="page-error">
            <p>No orders yet.</p>
            <a mat-flat-button routerLink="/menu">Go to the menu</a>
          </div>
        }
      } @else if (error()) {
        <div class="page-error" role="alert">
          <p>We couldn't load the orders. {{ error()!.message }}</p>
          <button mat-flat-button type="button" (click)="retry()">Try again</button>
        </div>
      } @else {
        @for (i of [1, 2, 3]; track i) {
          <div class="order skeleton" style="height: 160px" aria-hidden="true"></div>
        }
      }
    </div>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; padding: 16px; }
    h1 { font: var(--mat-sys-headline-small); margin: 8px 0 16px; }
    .order {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 12px;
      padding: 16px;
      border-radius: 16px;
      background: var(--mat-sys-surface-container-low);
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .order.done { opacity: 0.75; }
    header { display: flex; align-items: center; gap: 12px; }
    h2 { margin: 0; font: var(--mat-sys-title-medium); }
    time { color: var(--mat-sys-on-surface-variant); }
    .status {
      margin-left: auto;
      padding: 4px 10px;
      border-radius: 12px;
      font: var(--mat-sys-label-medium);
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      transition: background-color 300ms;
    }
    .status-COOKING { background: var(--mat-sys-tertiary-container); color: var(--mat-sys-on-tertiary-container); }
    .status-READY { background: #c8e6c9; color: #1b5e20; }
    .status-COMPLETED { background: var(--mat-sys-surface-container-highest); color: var(--mat-sys-on-surface-variant); }
    .lines { list-style: none; margin: 0; padding: 0; }
    .lines li { display: flex; justify-content: space-between; gap: 12px; padding: 2px 0; }
    footer { display: flex; justify-content: flex-end; align-items: baseline; gap: 12px; }
    .discount { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class OrdersPage {
  private readonly store = inject(Store);

  protected readonly orders = this.store.selectSignal(ordersFeature.selectAll);
  protected readonly loaded = this.store.selectSignal(ordersFeature.selectLoaded);
  protected readonly error = this.store.selectSignal(ordersFeature.selectError);

  protected label(status: OrderStatus): string {
    return STATUS_LABELS[status];
  }

  protected progress(status: OrderStatus): number {
    return (ORDER_STATUSES.indexOf(status) / (ORDER_STATUSES.length - 1)) * 100;
  }

  protected retry(): void {
    this.store.dispatch(OrdersActions.load());
  }
}
