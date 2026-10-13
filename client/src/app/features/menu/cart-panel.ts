import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MoneyPipe, toCents } from '../../shared/money.pipe';
import { QuantityStepper } from '../../shared/quantity-stepper';
import { authFeature } from '../../store/auth/auth.reducer';
import { CartActions } from '../../store/cart/cart.actions';
import { cartFeature } from '../../store/cart/cart.reducer';
import {
  selectCanCheckout,
  selectCartLines,
  selectCartProblems,
  selectDiscountTooLarge,
  selectSubtotal,
  selectTotal,
} from '../../store/cart/cart.selectors';
import { selectItemEntities } from '../../store/menu/menu.selectors';
import { describeProblem } from './cart-problem';
import { CheckoutDialog } from './checkout-dialog';

@Component({
  selector: 'app-cart-panel',
  template: `
    @let _closable = closable();
    @let _lines = lines();
    @let _problems = problems();
    @let _discountInput = discountInput();
    @let _discountTooLarge = discountTooLarge();
    @let _subtotal = subtotal();
    @let _discount = discount();
    @let _total = total();
    @let _canCheckout = canCheckout();
    @let _signedIn = signedIn();

    <header class="header">
      <h2>Your order</h2>
      @if (_closable) {
        <button class="close"
            type="button"
            aria-label="Close cart"
            (click)="closed.emit()"
            mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      }
    </header>

    @if (_lines.length === 0) {
      <p class="empty">Your cart is empty. Add something tasty from the menu.</p>
    } @else {
      @if (_problems.length > 0) {
        <div class="changes"
            role="alert">
          <mat-icon aria-hidden="true">warning</mat-icon>
          <span>
            {{ _problems.length === 1 ? '1 item has' : _problems.length + ' items have' }}
            changed since you added {{ _problems.length === 1 ? 'it' : 'them' }}.
          </span>
          <button type="button"
              (click)="applyChanges()"
              mat-stroked-button>Update cart</button>
        </div>
      }

      <ul class="lines">
        @for (line of _lines; track line.lineId) {
          <li class="line"
              [class.problem]="line.problem">
            <div class="line-main">
              <div class="line-name">
                {{ line.name }}
                @if (line.openPrice) {
                  <span class="tag">open price</span>
                }
              </div>
              <div class="line-meta">{{ line.unitPrice | money }} each</div>
              @if (line.problem) {
                <div class="line-problem">{{ describe(line) }}</div>
              }
            </div>
            <app-quantity-stepper [value]="line.quantity"
                [label]="line.name"
                (valueChange)="setQuantity(line.lineId, $event)" />
            <div class="line-total">{{ line.lineTotal | money }}</div>
          </li>
        }
      </ul>

      <mat-form-field class="discount"
          appearance="outline"
          subscriptSizing="dynamic">
        <mat-label>Discount</mat-label>
        <span matTextPrefix>$&nbsp;</span>
        <input type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            matInput
            [ngModel]="_discountInput"
            (ngModelChange)="setDiscount($event)" />
        @if (_discountTooLarge) {
          <mat-hint class="error">The discount cannot exceed the subtotal</mat-hint>
        }
      </mat-form-field>

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

      <div class="actions">
        <button type="button"
            (click)="clear()"
            mat-button>Clear</button>
        @if (_signedIn) {
          <button type="button"
              [disabled]="!_canCheckout"
              (click)="checkout()"
              mat-flat-button>
            Checkout · {{ _total | money }}
          </button>
        } @else {
          <!-- The cart is kept in localStorage, so nothing is lost while signing in. -->
          <a mat-flat-button
              routerLink="/login"
              [queryParams]="{ returnUrl: '/menu' }">Sign in to order</a>
        }
      </div>
    }
  `,
  styleUrl: './cart-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
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
  protected readonly discount = this.store.selectSignal(cartFeature.selectDiscount);
  protected readonly discountTooLarge = this.store.selectSignal(selectDiscountTooLarge);
  protected readonly canCheckout = this.store.selectSignal(selectCanCheckout);
  private readonly authStatus = this.store.selectSignal(authFeature.selectStatus);
  protected readonly signedIn = computed(() => this.authStatus() === 'authenticated');
  private readonly items = this.store.selectSignal(selectItemEntities);

  protected readonly discountInput = computed(() =>
    this.discount() ? this.discount() / 100 : null,
  );
  protected readonly describe = describeProblem;

  protected setQuantity(lineId: string, quantity: number): void {
    this.store.dispatch(CartActions.setQuantity({ lineId, quantity }));
  }

  protected setDiscount(value: number | string | null): void {
    const amount = Number(value);
    this.store.dispatch(
      CartActions.setDiscount({
        discount: Number.isFinite(amount) && amount > 0 ? toCents(amount) : 0,
      }),
    );
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
