import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import type { Action } from '@ngrx/store';
import { provideMockStore } from '@ngrx/store/testing';
import { Subject, defer, firstValueFrom, of, take, throwError, toArray } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { NotifyService } from '../../core/notify.service';
import { menuItem, order } from '../../testing/fixtures';
import { CartActions } from './cart.actions';
import { checkout, syncMenuFromCheckoutIssues } from './cart.effects';
import { emptyCart } from './cart.reducer';

describe('cart effects', () => {
  let actions$: Subject<Action>;
  const api = { placeOrder: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    actions$ = new Subject<Action>();
    api.placeOrder.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore({
          initialState: {
            cart: {
              ...emptyCart,
              checkoutKey: 'key-12345678',
              lines: [
                {
                  lineId: 'pizza',
                  itemId: 'pizza',
                  name: 'Pizza',
                  unitPrice: 1000,
                  openPrice: false,
                  quantity: 1,
                },
              ],
            },
          },
        }),
        { provide: ApiService, useValue: api },
        { provide: NotifyService, useValue: { info: vi.fn(), error: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('sends one request for a double click and uses the stored key', async () => {
    const response$ = new Subject<ReturnType<typeof order>>();
    api.placeOrder.mockReturnValue(response$);
    const result = firstValueFrom(TestBed.runInInjectionContext(() => checkout()));

    actions$.next(CartActions.checkout({ key: 'ignored' }));
    actions$.next(CartActions.checkout({ key: 'ignored' }));
    response$.next(order());
    response$.complete();

    expect(await result).toEqual(CartActions.checkoutSuccess({ order: order() }));
    expect(api.placeOrder).toHaveBeenCalledTimes(1);
    expect(api.placeOrder.mock.calls[0][1]).toBe('key-12345678');
  });

  it('retries network errors with the same key', async () => {
    let calls = 0;
    api.placeOrder.mockReturnValue(
      defer(() =>
        ++calls < 3 ? throwError(() => new HttpErrorResponse({ status: 0 })) : of(order()),
      ),
    );
    const result = firstValueFrom(TestBed.runInInjectionContext(() => checkout()));
    actions$.next(CartActions.checkout({ key: 'ignored' }));
    await vi.runAllTimersAsync();

    expect(await result).toEqual(CartActions.checkoutSuccess({ order: order() }));
    expect(api.placeOrder).toHaveBeenCalledTimes(1);
    expect(calls).toBe(3);
  });

  it('does not retry when the menu changed', async () => {
    api.placeOrder.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'MENU_CHANGED', message: 'changed', issues: [] },
          }),
      ),
    );
    const result = firstValueFrom(TestBed.runInInjectionContext(() => checkout()));
    actions$.next(CartActions.checkout({ key: 'ignored' }));

    const action = await result;
    expect(action.type).toBe(CartActions.checkoutFailure.type);
  });

  it('applies the item states returned with a MENU_CHANGED error', async () => {
    const changed = menuItem({ available: false, version: 2 });
    const result = firstValueFrom(
      TestBed.runInInjectionContext(() => syncMenuFromCheckoutIssues()).pipe(take(2), toArray()),
    );
    actions$.next(
      CartActions.checkoutFailure({
        error: {
          status: 409,
          code: 'MENU_CHANGED',
          message: '',
          issues: [
            { itemId: 'pizza', kind: 'unavailable', item: changed },
            { itemId: 'gone', kind: 'removed' },
          ],
        },
      }),
    );
    expect((await result).map((a) => a.type)).toEqual([
      '[Menu Live] Item Upserted',
      '[Menu Live] Item Deleted',
    ]);
  });
});
