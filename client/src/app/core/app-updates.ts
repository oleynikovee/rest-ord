import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { NotifyService } from './notify.service';

/** Tells the user when a new version was downloaded in the background. */
@Injectable({ providedIn: 'root' })
export class AppUpdates {
  private readonly updates = inject(SwUpdate);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  watch(): void {
    if (!this.updates.isEnabled) return;
    this.updates.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() =>
        this.notify
          .info('A new version of the app is available.', 'Reload')
          .onAction()
          .subscribe(() => document.location.reload()),
      );
  }
}
