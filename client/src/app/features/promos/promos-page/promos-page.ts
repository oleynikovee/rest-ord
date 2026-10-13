import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Observable } from 'rxjs';
import { type ApiError, toApiError } from '../../../core/api-error';
import { ApiService } from '../../../core/api.service';
import type { PromoCode, PromoCodeInput } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { formatMoney } from '../../../shared/money.pipe';
import { PromoDialog } from '../promo-dialog/promo-dialog';

function toInput(promo: PromoCode): PromoCodeInput {
  return {
    code: promo.code,
    description: promo.description,
    kind: promo.kind,
    value: promo.value,
    minOrderAmount: promo.minOrderAmount,
    maxDiscount: promo.maxDiscount,
    usageLimit: promo.usageLimit,
    perUserLimit: promo.perUserLimit,
    startsAt: promo.startsAt,
    expiresAt: promo.expiresAt,
    active: promo.active,
  };
}

/** Admin-only page; promo codes are not shared state of the ordering flow, so a signal store is enough here. */
@Component({
  selector: 'app-promos-page',
  templateUrl: './promos-page.html',
  styleUrl: './promos-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    DatePipe,
  ],
})
export class PromosPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly promos = signal<PromoCode[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.error.set(null);
    this.api
      .getPromoCodes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promos) => {
          this.promos.set(promos);
          this.loaded.set(true);
        },
        error: (error: unknown) => this.error.set(toApiError(error)),
      });
  }

  protected describe(promo: PromoCode): string {
    const amount = promo.kind === 'PERCENT' ? `${promo.value}% off` : `${formatMoney(promo.value)} off`;
    const cap = promo.maxDiscount === null ? '' : `, up to ${formatMoney(promo.maxDiscount)}`;
    const min = promo.minOrderAmount ? ` on orders from ${formatMoney(promo.minOrderAmount)}` : '';
    return `${amount}${cap}${min}${promo.description ? ` — ${promo.description}` : ''}`;
  }

  protected create(): void {
    this.openDialog(null, (input) => this.save(this.api.createPromoCode(input)));
  }

  protected edit(promo: PromoCode): void {
    this.openDialog(promo, (input) => this.save(this.api.updatePromoCode(promo, input), promo));
  }

  protected setActive(promo: PromoCode, active: boolean): void {
    this.save(this.api.updatePromoCode(promo, { ...toInput(promo), active }), promo);
  }

  private openDialog(promo: PromoCode | null, then: (input: PromoCodeInput) => void): void {
    this.dialog
      .open<PromoDialog, PromoCode | null, PromoCodeInput>(PromoDialog, { data: promo, maxWidth: '95vw' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((input) => input && then(input));
  }

  private save(request$: Observable<PromoCode>, previous?: PromoCode): void {
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => this.upsert(saved),
      error: (error: unknown) => {
        const apiError = toApiError(error);
        this.notify.error(apiError.message);
        // Version conflict: show the current state instead of the stale copy.
        const current = apiError.current;
        if (current && 'code' in current) this.upsert(current);
        else if (previous) this.upsert(previous);
      },
    });
  }

  private upsert(promo: PromoCode): void {
    this.promos.update((list) => {
      const next = list.some((p) => p.id === promo.id)
        ? list.map((p) => (p.id === promo.id ? promo : p))
        : [...list, promo];
      return next.sort((a, b) => a.code.localeCompare(b.code));
    });
  }
}
