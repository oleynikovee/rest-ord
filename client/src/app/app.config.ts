import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  provideZonelessChangeDetection,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { AppUpdates } from './core/app-updates';
import { authInterceptor } from './core/auth.interceptor';
import { ErrorReporter, ReportingErrorHandler } from './core/error-reporter';
import { provideAppStore } from './store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Default since Angular 21; stated explicitly so the app never falls back to zone.js.
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAppStore(),
    { provide: ErrorHandler, useClass: ReportingErrorHandler },
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
      // Not awaited: error reporting must not delay the first render.
      void inject(ErrorReporter).init();
      inject(AppUpdates).watch();
    }),
    // Offline app shell and cached menu (see ngsw-config.json); production builds only.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
