import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MoneyPipe } from '../../shared/money.pipe';
import { QuantityStepper } from '../../shared/quantity-stepper';
import { authFeature } from '../../store/auth/auth.reducer';
import { CartActions } from '../../store/cart/cart.actions';
import { cartFeature } from '../../store/cart/cart.reducer';
import {
  selectCanCheckout,
  selectCartLines,
  selectCartProblems,
  selectDiscount,
  selectPromoShortfall,
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
    @let _promo = promo();
    @let _promoPending = promoPending();
    @let _promoError = promoError();
    @let _promoShortfall = promoShortfall();
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

      @if (_promo) {
        <div class="promo-applied">
          <div>
            <div class="promo-code">{{ _promo.rule.code }}</div>
            <div class="promo-description">{{ _promo.description }}</div>
            @if (_promoShortfall > 0) {
              <div class="promo-hint">Add {{ _promoShortfall | money }} more to get this discount</div>
            }
          </div>
          <button type="button"
              [attr.aria-label]="'Remove promo code ' + _promo.rule.code"
              (click)="removePromo()"
              mat-icon-button>
            <mat-icon>close</mat-icon>
          </button>
        </div>
      } @else if (_signedIn) {
        <form class="promo-form"
            (submit)="applyPromo(promoInput.value); $event.preventDefault()">
          <mat-form-field class="promo-field"
              appearance="outline"
              subscriptSizing="dynamic">
            <mat-label>Promo code</mat-label>
            <input #promoInput
                autocapitalize="characters"
                autocomplete="off"
                maxlength="40"
                matInput />
            @if (_promoError) {
              <mat-hint class="error">{{ _promoError.message }}</mat-hint>
            }
          </mat-form-field>
          <button type="submit"
              [disabled]="_promoPending"
              mat-stroked-button>Apply</button>
        </form>
      } @else {
        <p class="promo-note">Sign in to use a promo code.</p>
      }

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
