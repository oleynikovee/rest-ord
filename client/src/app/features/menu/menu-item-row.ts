import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { MenuItem } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';
import { QuantityStepper } from '../../shared/quantity-stepper';

@Component({
  selector: 'app-menu-item-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MoneyPipe, QuantityStepper],
  template: `
    <div class="info">
      <div class="name">{{ item().name }}</div>
      <div class="description">{{ item().description }}</div>
    </div>
    <div class="price">
      @if (item().openPrice) {
        <span class="tag">Open price</span>
      } @else {
        {{ item().price | money }}
      }
    </div>
    <div class="action">
      @if (!item().available) {
        <span class="sold-out">Sold out</span>
      } @else if (item().openPrice) {
        <button mat-stroked-button type="button" (click)="add.emit()" [attr.aria-label]="'Add ' + item().name">
          {{ quantity() ? 'Add · ' + quantity() + ' in cart' : 'Add' }}
        </button>
      } @else if (quantity() > 0) {
        <app-quantity-stepper
          [value]="quantity()"
          [label]="item().name"
          (valueChange)="quantityChange.emit($event)"
        />
      } @else {
        <button mat-flat-button type="button" (click)="add.emit()" [attr.aria-label]="'Add ' + item().name">
          Add
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 1fr auto 150px;
      align-items: center;
      gap: 12px;
      height: 72px;
      padding: 0 16px;
      box-sizing: border-box;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    :host(.unavailable) .info,
    :host(.unavailable) .price { opacity: 0.5; }
    .info { min-width: 0; }
    .name, .description { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name { font: var(--mat-sys-title-small); }
    .description { font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .price { font-variant-numeric: tabular-nums; }
    .action { display: flex; justify-content: flex-end; }
    .tag, .sold-out {
      font: var(--mat-sys-label-small);
      padding: 2px 8px;
      border-radius: 8px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .sold-out { background: var(--mat-sys-surface-container-highest); color: var(--mat-sys-on-surface-variant); }
    @media (max-width: 599px) {
      :host { grid-template-columns: 1fr auto; grid-template-rows: auto auto; gap: 2px 8px; padding: 0 12px; align-content: center; }
      .info { grid-column: 1; grid-row: 1; }
      .description { display: none; }
      .price { grid-column: 1; grid-row: 2; }
      .action { grid-column: 2; grid-row: 1 / span 2; }
    }
  `,
  host: { '[class.unavailable]': '!item().available' },
})
export class MenuItemRow {
  readonly item = input.required<MenuItem>();
  readonly quantity = input(0);
  readonly add = output();
  readonly quantityChange = output<number>();
}
