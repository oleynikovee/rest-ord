import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { MenuItem } from '../../../core/models';
import { MoneyPipe } from '../../../shared/money.pipe';
import { QuantityStepper } from '../../../shared/quantity-stepper/quantity-stepper';

@Component({
  selector: 'app-menu-item-row',
  templateUrl: './menu-item-row.html',
  styleUrl: './menu-item-row.scss',
  host: {
    '[class.unavailable]': '!item().available',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MoneyPipe,
    QuantityStepper,
  ],
})
export class MenuItemRow {
  readonly item = input.required<MenuItem>();
  readonly quantity = input(0);
  readonly add = output();
  readonly quantityChange = output<number>();
}
