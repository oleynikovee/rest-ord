import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MoneyPipe } from '../../../shared/money.pipe';
import { QuantityStepper } from '../../../shared/quantity-stepper/quantity-stepper';
import { authFeature } from '../../../store/auth/auth.reducer';
import { CartActions } from '../../../store/cart/cart.actions';
import { cartFeature } from '../../../store/cart/cart.reducer';
import {
  selectCanCheckout,
  selectCartLines,
  selectCartProblems,
  selectDiscount,
  selectPromoShortfall,
  selectSubtotal,
  selectTotal,
} from '../../../store/cart/cart.selectors';
import { selectItemEntities } from '../../../store/menu/menu.selectors';
import { describeProblem } from '../cart-problem';
import { CheckoutDialog } from '../checkout-dialog/checkout-dialog';

@Component({
  selector: 'app-cart-panel',
  templateUrl: './cart-panel.html',
  styleUrl: './cart-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
    MoneyPipe,
    QuantityStepper,
  ],
})
export class CartPanel {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);

  readonly closable = input(true);
  readonly closed = output();

  protected readonly lines = this.store.selectSignal(selectCartLines);
  protected readonly problems = this.store.selectSignal(selectCartProblems);
  protected readonly subtotal = this.store.selectSignal(selectSubtotal);
  protected readonly total = this.store.selectSignal(selectTotal);
  protected readonly discount = this.store.selectSignal(selectDiscount);
  protected readonly promo = this.store.selectSignal(cartFeature.selectPromo);
  protected readonly promoPending = this.store.selectSignal(cartFeature.selectPromoPending);
  protected readonly promoError = this.store.selectSignal(cartFeature.selectPromoError);
  protected readonly promoShortfall = this.store.selectSignal(selectPromoShortfall);
  protected readonly canCheckout = this.store.selectSignal(selectCanCheckout);
  private readonly authStatus = this.store.selectSignal(authFeature.selectStatus);
  protected readonly signedIn = computed(() => this.authStatus() === 'authenticated');
  private readonly items = this.store.selectSignal(selectItemEntities);

  protected readonly describe = describeProblem;

  protected setQuantity(lineId: string, quantity: number): void {
    this.store.dispatch(CartActions.setQuantity({ lineId, quantity }));
  }

  protected applyPromo(code: string): void {
    if (code.trim()) this.store.dispatch(CartActions.applyPromo({ code: code.trim() }));
  }

  protected removePromo(): void {
    this.store.dispatch(CartActions.removePromo());
  }

  protected applyChanges(): void {
    const items = this.items();
    const relevant = Object.fromEntries(
      this.lines().map((line) => [line.itemId, items[line.itemId]]),
    );
    this.store.dispatch(CartActions.applyMenuChanges({ items: relevant }));
  }

  protected clear(): void {
    this.store.dispatch(CartActions.clear());
  }

  protected checkout(): void {
    this.dialog.open(CheckoutDialog, { width: '480px', maxWidth: '95vw', autoFocus: 'dialog' });
  }
}
