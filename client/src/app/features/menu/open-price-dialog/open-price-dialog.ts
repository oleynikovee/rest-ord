import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { MenuItem } from '../../../core/models';
import { invalidSignal } from '../../../shared/form-signals';
import { toCents } from '../../../shared/money.pipe';

export interface OpenPriceResult {
  unitPrice: number;
  quantity: number;
}

@Component({
  selector: 'app-open-price-dialog',
  templateUrl: './open-price-dialog.html',
  styleUrl: './open-price-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
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
