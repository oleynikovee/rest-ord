import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { ORDER_STATUSES, type OrderStatus } from '../../../core/models';
import { MoneyPipe } from '../../../shared/money.pipe';
import { authFeature } from '../../../store/auth/auth.reducer';
import { OrdersActions } from '../../../store/orders/orders.actions';
import { ordersFeature } from '../../../store/orders/orders.reducer';

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'New',
  ACCEPTED: 'Accepted',
  COOKING: 'Cooking',
  READY: 'Ready for pickup',
  COMPLETED: 'Completed',
};

@Component({
  selector: 'app-orders-page',
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatProgressBarModule,
    DatePipe,
    RouterLink,
    MoneyPipe,
  ],
})
export class OrdersPage {
  private readonly store = inject(Store);

  protected readonly orders = this.store.selectSignal(ordersFeature.selectAll);
  protected readonly loaded = this.store.selectSignal(ordersFeature.selectLoaded);
  protected readonly error = this.store.selectSignal(ordersFeature.selectError);
  protected readonly isAdmin = this.store.selectSignal(authFeature.selectIsAdmin);
  protected readonly nextCursor = this.store.selectSignal(ordersFeature.selectNextCursor);
  protected readonly loadingMore = this.store.selectSignal(ordersFeature.selectLoadingMore);

  protected label(status: OrderStatus): string {
    return STATUS_LABELS[status];
  }

  protected progress(status: OrderStatus): number {
    return (ORDER_STATUSES.indexOf(status) / (ORDER_STATUSES.length - 1)) * 100;
  }

  protected loadMore(): void {
    this.store.dispatch(OrdersActions.loadMore());
  }

  protected retry(): void {
    this.store.dispatch(OrdersActions.load());
  }
}
