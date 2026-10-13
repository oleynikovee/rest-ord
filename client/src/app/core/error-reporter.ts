import { HttpClient } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface ClientConfig {
  sentryDsn: string | null;
  environment: string;
  release: string | null;
}

type Capture = (error: unknown) => void;

/**
 * Sends unexpected errors to Sentry when the server provides a DSN (GET /api/config).
 * The SDK is loaded lazily and only then, so it costs nothing when reporting is off.
 * Errors raised before it is ready are queued.
 */
@Injectable({ providedIn: 'root' })
export class ErrorReporter {
  private readonly http = inject(HttpClient);
  private capture: Capture | null = null;
  private readonly queue: unknown[] = [];
  private disabled = false;

  async init(): Promise<void> {
    try {
      const config = await firstValueFrom(this.http.get<ClientConfig>('/api/config'));
      if (!config.sentryDsn) {
        this.disable();
        return;
      }
      const Sentry = await import('@sentry/browser');
      Sentry.init({
        dsn: config.sentryDsn,
        environment: config.environment,
        release: config.release ?? undefined,
      });
      this.capture = (error) => Sentry.captureException(error);
      this.queue.splice(0).forEach((error) => this.capture?.(error));
    } catch {
      // Reporting must never break the app.
      this.disable();
    }
  }

  report(error: unknown): void {
    if (this.capture) this.capture(error);
    else if (!this.disabled && this.queue.length < 20) this.queue.push(error);
  }

  private disable(): void {
    this.disabled = true;
    this.queue.length = 0;
  }
}

/** Keeps Angular's console output and also reports the error. */
@Injectable()
export class ReportingErrorHandler extends ErrorHandler {
  private readonly reporter = inject(ErrorReporter);

  override handleError(error: unknown): void {
    super.handleError(error);
    this.reporter.report(error);
  }
}
