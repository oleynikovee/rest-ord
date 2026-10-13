import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Category, MenuItem, MenuItemInput } from '../../core/models';
import { invalidSignal } from '../../shared/form-signals';
import { toCents } from '../../shared/money.pipe';

export interface ItemDialogData {
  categories: Category[];
  categoryId: string;
  item?: MenuItem;
  /** Pre-set values, e.g. turning off "open price" for an item without a price. */
  overrides?: Partial<MenuItemInput>;
}

@Component({
  selector: 'app-item-dialog',
  template: `
    @let _openPrice = openPrice();
    @let _invalid = invalid();

    <h2 mat-dialog-title>{{ data.item ? 'Edit item' : 'New item' }}</h2>
    <form [formGroup]="form"
        (ngSubmit)="submit()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input maxlength="100"
              matInput
              formControlName="name"
              cdkFocusInitial />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea maxlength="300"
              rows="2"
              matInput
              formControlName="description"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select formControlName="categoryId">
            @for (category of data.categories; track category.id) {
              <mat-option [value]="category.id">{{ category.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-checkbox formControlName="openPrice">Open price (entered when ordering)</mat-checkbox>
        @if (!_openPrice) {
          <mat-form-field appearance="outline">
            <mat-label>Price</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input type="number"
                inputmode="decimal"
                min="0"
                step="0.01"
                matInput
                formControlName="price" />
            <mat-error>Enter a price from 0 to 10 000</mat-error>
          </mat-form-field>
        }
        <mat-checkbox formControlName="available">Available</mat-checkbox>
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
      min-width: min(420px, 80vw);
    }
    mat-checkbox {
      margin-bottom: 8px;
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
export class ItemDialog {
  protected readonly data = inject<ItemDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ItemDialog, MenuItemInput>>(MatDialogRef);

  private readonly initial: MenuItemInput = {
    categoryId: this.data.item?.categoryId ?? this.data.categoryId,
    name: this.data.item?.name ?? '',
    description: this.data.item?.description ?? '',
    price: this.data.item?.price ?? null,
    available: this.data.item?.available ?? true,
    openPrice: this.data.item?.openPrice ?? false,
    ...this.data.overrides,
  };

  protected readonly form = new FormGroup({
    name: new FormControl(this.initial.name, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
    description: new FormControl(this.initial.description, { nonNullable: true }),
    categoryId: new FormControl(this.initial.categoryId, {
      nonNullable: true,
      validators: Validators.required,
    }),
    price: new FormControl<number | null>(
      this.initial.price === null ? null : this.initial.price / 100,
      [Validators.min(0), Validators.max(10000)],
    ),
    openPrice: new FormControl(this.initial.openPrice, { nonNullable: true }),
    available: new FormControl(this.initial.available, { nonNullable: true }),
  });

  protected readonly openPrice = toSignal(this.form.controls.openPrice.valueChanges, {
    initialValue: this.initial.openPrice,
  });

  protected readonly invalid = invalidSignal(this.form);

  constructor() {
    // Price is required only for fixed-price items.
    this.form.controls.openPrice.valueChanges.pipe(takeUntilDestroyed()).subscribe((open) => {
      const price = this.form.controls.price;
      if (open) price.removeValidators(Validators.required);
      else price.addValidators(Validators.required);
      price.updateValueAndValidity();
    });
    this.form.controls.openPrice.updateValueAndValidity({ emitEvent: true });
  }

  protected submit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.ref.close({
      ...value,
      name: value.name.trim(),
      description: value.description.trim(),
      price: value.price === null ? (value.openPrice ? null : 0) : toCents(value.price),
    });
  }
}
