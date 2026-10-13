import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { MenuItem } from '../../core/models';
import { invalidSignal } from '../../shared/form-signals';
import { toCents } from '../../shared/money.pipe';

export interface OpenPriceResult {
  unitPrice: number;
  quantity: number;
}

/** Asks for the price (and quantity) of an open-price item when it is added to the order. */
@Component({
  selector: 'app-open-price-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ item.name }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <p class="hint">This item has no fixed price. Enter the agreed price.</p>
        <mat-form-field appearance="outline">
          <mat-label>Price</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input
            matInput
            type="number"
            inputmode="decimal"
            min="0.01"
            step="0.01"
            formControlName="price"
            cdkFocusInitial
          />
          <mat-error>Enter a price from 0.01 to 10 000</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Quantity</mat-label>
          <input
            matInput
            type="number"
            inputmode="numeric"
            min="1"
            max="99"
            step="1"
            formControlName="quantity"
          />
          <mat-error>From 1 to 99</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="invalid()">Add to cart</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      width: 100%;
    }
    .hint {
      margin-top: 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class OpenPriceDialog {
  protected readonly item = inject<MenuItem>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<OpenPriceDialog, OpenPriceResult>>(MatDialogRef);

  protected readonly form = new FormGroup({
    price: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(10000),
    ]),
    quantity: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(99)],
    }),
  });

  protected readonly invalid = invalidSignal(this.form);

  protected submit(): void {
    if (this.form.invalid) return;
    const { price, quantity } = this.form.getRawValue();
    this.ref.close({ unitPrice: toCents(price ?? 0), quantity: Math.floor(quantity) });
  }
}
