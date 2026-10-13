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
  template: `
    @let _problems = problems();
    @let _error = error();
    @let _lines = lines();
    @let _subtotal = subtotal();
    @let _discount = discount();
    @let _total = total();
    @let _submitting = submitting();
    @let _canCheckout = canCheckout();

    <h2 mat-dialog-title>Confirm your order</h2>
    <mat-dialog-content>
      @if (_problems.length > 0) {
        <div class="alert"
            role="alert">
          <strong>The menu has changed.</strong> Close this window and update your cart to continue:
          <ul>
            @for (line of _problems; track line.lineId) {
              <li>{{ line.name }}: {{ describe(line) }}</li>
            }
          </ul>
        </div>
      }
      @if (_error && _error.code !== 'MENU_CHANGED') {
        <div class="alert"
            role="alert">{{ _error.message }}</div>
      }

      <ul class="summary">
        @for (line of _lines; track line.lineId) {
          <li>
            <span>{{ line.quantity }} × {{ line.name }}</span>
            <span>{{ line.lineTotal | money }}</span>
          </li>
        }
      </ul>
      <dl class="totals">
        <dt>Subtotal</dt>
        <dd>{{ _subtotal | money }}</dd>
        @if (_discount > 0) {
          <dt>Discount</dt>
          <dd>−{{ _discount | money }}</dd>
        }
        <dt class="grand">Total</dt>
        <dd class="grand">{{ _total | money }}</dd>
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button"
          [disabled]="_submitting"
          mat-button
          mat-dialog-close>
        {{ _problems.length ? 'Review cart' : 'Cancel' }}
      </button>
      <button type="button"
          [disabled]="!_canCheckout"
          (click)="confirm()"
          mat-flat-button>
        @if (_submitting) {
          <mat-spinner diameter="18"
              aria-label="Placing order" />
        } @else {
          Place order · {{ _total | money }}
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
      ul {
        margin: 8px 0 0;
        padding-left: 20px;
      }
    }
    .summary {
      list-style: none;
      padding: 0;
      margin: 0 0 8px;
    }
    .summary li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
    }
    .totals {
      display: grid;
      grid-template-columns: 1fr auto;
      row-gap: 4px;
      margin: 0;
    }
    .totals dd {
      margin: 0;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .grand {
      font: var(--mat-sys-title-medium);
    }
    mat-spinner {
      display: inline-block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MoneyPipe,
  ],
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
