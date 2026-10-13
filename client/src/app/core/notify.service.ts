import { Injectable, inject } from '@angular/core';
import { MatSnackBar, type MatSnackBarRef, type TextOnlySnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snackBar = inject(MatSnackBar);

  info(message: string, action?: string): MatSnackBarRef<TextOnlySnackBar> {
    return this.snackBar.open(message, action ?? 'OK', { duration: 4000 });
  }

  error(message: string): MatSnackBarRef<TextOnlySnackBar> {
    return this.snackBar.open(message, 'Dismiss', { duration: 7000, panelClass: 'snack-error' });
  }
}
