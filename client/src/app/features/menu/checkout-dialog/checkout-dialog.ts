import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { newIdempotencyKey } from '../../../core/idempotency-key';
import { MoneyPipe } from '../../../shared/money.pipe';
import { CartActions } from '../../../store/cart/cart.actions';
import { cartFeature } from '../../../store/cart/cart.reducer';
import {
  selectCanCheckout,
  selectDiscount,
  selectCartLines,
  selectCartProblems,
  selectSubtotal,
  selectTotal,
} from '../../../store/cart/cart.selectors';
import { describeProblem } from '../cart-problem';

@Component({
  selector: 'app-checkout-dialog',
  templateUrl: './checkout-dialog.html',
  styleUrl: './checkout-dialog.scss',
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
  protected readonly discount = this.store.selectSignal(selectDiscount);
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
    this.store.dispatch(CartActions.checkout({ key: newIdempotencyKey() }));
  }
}
