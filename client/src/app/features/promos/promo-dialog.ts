import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { normalizePromoCode, type PromoCode, type PromoCodeInput, type PromoKind } from '../../core/models';
import { invalidSignal } from '../../shared/form-signals';
import { toCents } from '../../shared/money.pipe';

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
  template: `
    @let _kind = kind();
    @let _invalid = invalid();

    <h2 mat-dialog-title>{{ data ? 'Edit promo code' : 'New promo code' }}</h2>
    <form [formGroup]="form"
        (ngSubmit)="submit()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Code</mat-label>
          <input autocapitalize="characters"
              maxlength="40"
              matInput
              formControlName="code"
              cdkFocusInitial />
          <mat-hint>3–40 letters, digits, "-" or "_"; case-insensitive</mat-hint>
          <mat-error>3–40 letters, digits, "-" or "_"</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description shown to customers</mat-label>
          <input maxlength="200"
              matInput
              formControlName="description" />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select formControlName="kind">
              <mat-option value="PERCENT">Percent off</mat-option>
              <mat-option value="FIXED">Fixed amount off</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ _kind === 'PERCENT' ? 'Percent' : 'Amount' }}</mat-label>
            @if (_kind === 'FIXED') {
              <span matTextPrefix>$&nbsp;</span>
            }
            <input type="number"
                inputmode="decimal"
                min="0"
                matInput
                formControlName="value" />
            @if (_kind === 'PERCENT') {
              <span matTextSuffix>%</span>
            }
            <mat-error>{{ _kind === 'PERCENT' ? 'From 1 to 100' : 'More than 0' }}</mat-error>
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Minimum order</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input type="number"
                inputmode="decimal"
                min="0"
                matInput
                formControlName="minOrderAmount" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Maximum discount</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input type="number"
                inputmode="decimal"
                min="0"
                placeholder="No cap"
                matInput
                formControlName="maxDiscount" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Total uses</mat-label>
            <input type="number"
                inputmode="numeric"
                min="1"
                placeholder="Unlimited"
                matInput
                formControlName="usageLimit" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Uses per customer</mat-label>
            <input type="number"
                inputmode="numeric"
                min="1"
                placeholder="Unlimited"
                matInput
                formControlName="perUserLimit" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Starts</mat-label>
            <input type="datetime-local"
                matInput
                formControlName="startsAt" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Ends</mat-label>
            <input type="datetime-local"
                matInput
                formControlName="expiresAt" />
          </mat-form-field>
        </div>
        <mat-checkbox formControlName="active">Active</mat-checkbox>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button"
            mat-button
            mat-dialog-close>Cancel</button>
        <button type="submit"
            [disabled]="_invalid"
            mat-flat-button>Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .fields {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: min(520px, 80vw);
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 599px) {
      .row {
        grid-template-columns: 1fr;
        gap: 0;
      }
    }
  `,
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
