import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { invalidSignal } from '../../../shared/form-signals';
import { AuthActions } from '../../../store/auth/auth.actions';
import { authFeature } from '../../../store/auth/auth.reducer';

type Mode = 'login' | 'register';

function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/menu';
}

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
})
export class LoginPage {
  private readonly store = inject(Store);

  readonly returnUrl = input<string>();

  protected readonly mode = signal<Mode>('login');
  protected readonly submitting = this.store.selectSignal(authFeature.selectSubmitting);
  protected readonly error = this.store.selectSignal(authFeature.selectError);

  protected readonly loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly registerForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  protected readonly loginInvalid = invalidSignal(this.loginForm);
  protected readonly registerInvalid = invalidSignal(this.registerForm);
  private readonly target = computed(() => safeReturnUrl(this.returnUrl()));

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
  }

  protected login(): void {
    if (this.loginForm.invalid) return;
    this.store.dispatch(
      AuthActions.login({ request: this.loginForm.getRawValue(), returnUrl: this.target() }),
    );
  }

  protected register(): void {
    if (this.registerForm.invalid) return;
    const { name, email, password } = this.registerForm.getRawValue();
    this.store.dispatch(
      AuthActions.register({
        request: { name: name.trim(), email, password },
        returnUrl: this.target(),
      }),
    );
  }
}
