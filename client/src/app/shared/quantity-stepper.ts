import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-quantity-stepper',
  template: `
    @let _value = value();
    @let _label = label();
    @let _max = max();

    <button type="button"
        [attr.aria-label]="'Decrease quantity of ' + _label"
        (click)="valueChange.emit(_value - 1)"
        mat-icon-button>
      <mat-icon>{{ _value === 1 ? 'delete' : 'remove' }}</mat-icon>
    </button>
    <span class="value"
        aria-live="polite">{{ _value }}</span>
    <button type="button"
        [disabled]="_value >= _max"
        [attr.aria-label]="'Increase quantity of ' + _label"
        (click)="valueChange.emit(_value + 1)"
        mat-icon-button>
      <mat-icon>add</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }
    .value {
      min-width: 24px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
  ],
})
export class QuantityStepper {
  readonly value = input.required<number>();
  readonly label = input('item');
  readonly max = input(99);
  readonly valueChange = output<number>();
}
