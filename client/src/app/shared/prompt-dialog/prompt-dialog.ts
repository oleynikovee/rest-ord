import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { invalidSignal } from '../form-signals';

export interface PromptData {
  title: string;
  label: string;
  value?: string;
  confirm: string;
}

@Component({
  selector: 'app-prompt-dialog',
  templateUrl: './prompt-dialog.html',
  styleUrl: './prompt-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
})
export class PromptDialog {
  protected readonly data = inject<PromptData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<PromptDialog, string>>(MatDialogRef);
  protected readonly control = new FormControl(this.data.value ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(60), Validators.pattern(/\S/)],
  });

  protected readonly invalid = invalidSignal(this.control);

  protected submit(): void {
    if (this.control.valid) this.ref.close(this.control.value.trim());
  }
}
