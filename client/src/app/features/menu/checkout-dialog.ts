import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { newIdempotencyKey } from '../../core/idempotency-key';
import { MoneyPipe } from '../../shared/money.pipe';
import { CartActions } from '../../store/cart/cart.actions';
import { cartFeature } from '../../store/cart/cart.reducer';
import {
  selectCanCheckout,
  selectCartLines,
  selectCartProblems,
  selectSubtotal,
  selectTotal,
} from '../../store/cart/cart.selectors';
import { describeProblem } from './cart-problem';

/**
 * Final confirmation. It reads the cart live, so a price or availability change
 * that arrives while the dialog is open is shown and blocks confirmation.
 */
@Component({
  selector: 'app-checkout-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule, MoneyPipe],
  template: `
    <h2 mat-dialog-title>Confirm your order</h2>
    <mat-dialog-content>
      @if (problems().length > 0) {
        <div class="alert" role="alert">
          <strong>The menu has changed.</strong> Close this window and update your cart to continue:
          <ul>
            @for (line of problems(); track line.lineId) {
              <li>{{ line.name }}: {{ describe(line) }}</li>
            }
          </ul>
        </div>
      }
      @if (error() && error()!.code !== 'MENU_CHANGED') {
        <div class="alert" role="alert">{{ error()!.message }}</div>
      }

      <ul class="summary">
        @for (line of lines(); track line.lineId) {
          <li>
            <span>{{ line.quantity }} × {{ line.name }}</span>
            <span>{{ line.lineTotal | money }}</span>
          </li>
        }
      </ul>
      <dl class="totals">
        <dt>Subtotal</dt>
        <dd>{{ subtotal() | money }}</dd>
        @if (discount() > 0) {
          <dt>Discount</dt>
          <dd>−{{ discount() | money }}</dd>
        }
        <dt class="grand">Total</dt>
        <dd class="grand">{{ total() | money }}</dd>
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close [disabled]="submitting()">
        {{ problems().length ? 'Review cart' : 'Cancel' }}
      </button>
      <button mat-flat-button type="button" [disabled]="!canCheckout()" (click)="confirm()">
        @if (submitting()) {
          <mat-spinner diameter="18" aria-label="Placing order" />
        } @else {
          Place order · {{ total() | money }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .alert {
      padding: 12px;
      margin-bottom: 12px;
      border-radius: 12px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      ul { margin: 8px 0 0; padding-left: 20px; }
    }
    .summary { list-style: none; padding: 0; margin: 0 0 8px; }
    .summary li { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; }
    .totals { display: grid; grid-template-columns: 1fr auto; row-gap: 4px; margin: 0; }
    .totals dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
    .grand { font: var(--mat-sys-title-medium); }
    mat-spinner { display: inline-block; }
  `,
})
export class CheckoutDialog {
  private readonly store = inject(Store);
  private readonly ref = inject(MatDialogRef<CheckoutDialog>);

  protected readonly lines = this.store.selectSignal(selectCartLines);
  protected readonly problems = this.store.selectSignal(selectCartProblems);
  protected readonly subtotal = this.store.selectSignal(selectSubtotal);
  protected readonly total = this.store.selectSignal(selectTotal);
  protected readonly discount = this.store.selectSignal(cartFeature.selectDiscount);
  protected readonly canCheckout = this.store.selectSignal(selectCanCheckout);
  protected readonly submitting = this.store.selectSignal(cartFeature.selectSubmitting);
  protected readonly error = this.store.selectSignal(cartFeature.selectError);
  protected readonly describe = describeProblem;

  constructor() {
    inject(Actions)
      .pipe(ofType(CartActions.checkoutSuccess), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.ref.close(true));
  }

  protected confirm(): void {
    // The key is only used if there is no pending attempt for this exact cart.
    this.store.dispatch(CartActions.checkout({ key: newIdempotencyKey() }));
  }
}
