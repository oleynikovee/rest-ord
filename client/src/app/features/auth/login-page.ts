import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { invalidSignal } from '../../shared/form-signals';
import { AuthActions } from '../../store/auth/auth.actions';
import { authFeature } from '../../store/auth/auth.reducer';

type Mode = 'login' | 'register';

/** Only same-app paths are allowed as a return URL (no open redirects). */
function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/menu';
}

@Component({
  selector: 'app-login-page',
  template: `
    @let _mode = mode();
    @let _submitting = submitting();
    @let _error = error();
    @let _loginInvalid = loginInvalid();
    @let _registerInvalid = registerInvalid();

    <div class="page">
      <section class="card"
          aria-labelledby="auth-title">
        <h1 id="auth-title">{{ _mode === 'login' ? 'Sign in' : 'Create an account' }}</h1>

        <mat-button-toggle-group class="mode"
            aria-label="Sign in or register"
            hideSingleSelectionIndicator
            [value]="_mode"
            (change)="setMode($event.value)">
          <mat-button-toggle value="login">Sign in</mat-button-toggle>
          <mat-button-toggle value="register">Register</mat-button-toggle>
        </mat-button-toggle-group>

        @if (_error) {
          <div class="alert"
              role="alert">{{ _error.message }}</div>
        }

        @if (_mode === 'login') {
          <form class="form"
              [formGroup]="loginForm"
              (ngSubmit)="login()">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input type="email"
                  autocomplete="username"
                  matInput
                  formControlName="email" />
              <mat-error>Enter a valid email</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input type="password"
                  autocomplete="current-password"
                  matInput
                  formControlName="password" />
              <mat-error>Enter your password</mat-error>
            </mat-form-field>
            <button type="submit"
                [disabled]="_loginInvalid || _submitting"
                mat-flat-button>
              @if (_submitting) {
                <mat-spinner diameter="18"
                    aria-label="Signing in" />
              } @else {
                Sign in
              }
            </button>
          </form>
          <p class="demo">
            Demo accounts: <code>guest&#64;trattoria.local</code> / <code>guest12345</code> (customer),
            <code>admin&#64;trattoria.local</code> / <code>admin12345</code> (admin).
          </p>
        } @else {
          <form class="form"
              [formGroup]="registerForm"
              (ngSubmit)="register()">
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input autocomplete="name"
                  maxlength="60"
                  matInput
                  formControlName="name" />
              <mat-error>Enter your name</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input type="email"
                  autocomplete="email"
                  matInput
                  formControlName="email" />
              <mat-error>Enter a valid email</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input type="password"
                  autocomplete="new-password"
                  matInput
                  formControlName="password" />
              <mat-hint>At least 8 characters</mat-hint>
              <mat-error>At least 8 characters</mat-error>
            </mat-form-field>
            <button type="submit"
                [disabled]="_registerInvalid || _submitting"
                mat-flat-button>
              @if (_submitting) {
                <mat-spinner diameter="18"
                    aria-label="Creating account" />
              } @else {
                Create account
              }
            </button>
          </form>
        }
      </section>
    </div>
  `,
  styles: `
    .page {
      display: flex;
      justify-content: center;
      padding: 32px 16px;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: min(420px, 100%);
      padding: 24px;
      border-radius: 20px;
      background: var(--mat-sys-surface-container-low);
      border: 1px solid var(--mat-sys-outline-variant);
      box-sizing: border-box;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }
    .mode {
      align-self: flex-start;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .alert {
      padding: 12px;
      border-radius: 12px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .demo {
      margin: 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    mat-spinner {
      display: inline-block;
    }
  `,
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

  /** Bound from the `returnUrl` query parameter. */
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
