import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { normalizePromoCode, type PromoCode, type PromoCodeInput, type PromoKind } from '../../../core/models';
import { invalidSignal } from '../../../shared/form-signals';
import { toCents } from '../../../shared/money.pipe';

/** `<input type="datetime-local">` works in local time without a zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

const optionalNumber = (value: number | null): number | null =>
  value === null || Number.isNaN(value) ? null : value;

@Component({
  selector: 'app-promo-dialog',
  templateUrl: './promo-dialog.html',
  styleUrl: './promo-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
})
export class PromoDialog {
  protected readonly data = inject<PromoCode | null>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<PromoDialog, PromoCodeInput>>(MatDialogRef);

  protected readonly form = new FormGroup({
    code: new FormControl(this.data?.code ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\s*[A-Za-z0-9_-]{3,40}\s*$/)],
    }),
    description: new FormControl(this.data?.description ?? '', { nonNullable: true }),
    kind: new FormControl<PromoKind>(this.data?.kind ?? 'PERCENT', { nonNullable: true }),
    value: new FormControl<number | null>(this.initialValue(), [Validators.required, Validators.min(0.01)]),
    minOrderAmount: new FormControl<number | null>((this.data?.minOrderAmount ?? 0) / 100, [Validators.min(0)]),
    maxDiscount: new FormControl<number | null>(
      this.data?.maxDiscount == null ? null : this.data.maxDiscount / 100,
      [Validators.min(0)],
    ),
    usageLimit: new FormControl<number | null>(this.data?.usageLimit ?? null, [Validators.min(1)]),
    perUserLimit: new FormControl<number | null>(this.data?.perUserLimit ?? null, [Validators.min(1)]),
    startsAt: new FormControl(toLocalInput(this.data?.startsAt ?? null), { nonNullable: true }),
    expiresAt: new FormControl(toLocalInput(this.data?.expiresAt ?? null), { nonNullable: true }),
    active: new FormControl(this.data?.active ?? true, { nonNullable: true }),
  });

  protected readonly kind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: this.form.controls.kind.value,
  });
  protected readonly invalid = invalidSignal(this.form);

  protected submit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const value = v.kind === 'PERCENT' ? Math.round(v.value ?? 0) : toCents(v.value ?? 0);
    const maxDiscount = optionalNumber(v.maxDiscount);
    this.ref.close({
      code: normalizePromoCode(v.code),
      description: v.description.trim(),
      kind: v.kind,
      value,
      minOrderAmount: toCents(optionalNumber(v.minOrderAmount) ?? 0),
      maxDiscount: maxDiscount === null ? null : toCents(maxDiscount),
      usageLimit: optionalNumber(v.usageLimit),
      perUserLimit: optionalNumber(v.perUserLimit),
      startsAt: fromLocalInput(v.startsAt),
      expiresAt: fromLocalInput(v.expiresAt),
      active: v.active,
    });
  }

  private initialValue(): number | null {
    if (!this.data) return null;
    return this.data.kind === 'PERCENT' ? this.data.value : this.data.value / 100;
  }
}
