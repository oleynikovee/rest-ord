import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-quantity-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button
      mat-icon-button
      type="button"
      (click)="valueChange.emit(value() - 1)"
      [attr.aria-label]="'Decrease quantity of ' + label()"
    >
      <mat-icon>{{ value() === 1 ? 'delete' : 'remove' }}</mat-icon>
    </button>
    <span class="value" aria-live="polite">{{ value() }}</span>
    <button
      mat-icon-button
      type="button"
      [disabled]="value() >= max()"
      (click)="valueChange.emit(value() + 1)"
      [attr.aria-label]="'Increase quantity of ' + label()"
    >
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
})
export class QuantityStepper {
  readonly value = input.required<number>();
  readonly label = input('item');
  readonly max = input(99);
  readonly valueChange = output<number>();
}
