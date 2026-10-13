import { type ActionReducer, createFeature, createReducer, on } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { PromoQuote } from '../../core/models';
import { CartActions } from './cart.actions';
import { type CartLine, MAX_QUANTITY, lineIdFor, lineProblem } from './cart.models';

export interface CartState {
  lines: CartLine[];
  promo: PromoQuote | null;
  promoPending: boolean;
  promoError: ApiError | null;
  checkoutKey: string | null;
  submitting: boolean;
  error: ApiError | null;
}

export const CART_STORAGE_KEY = 'restaurant.cart.v1';

export const emptyCart: CartState = {
  lines: [],
  promo: null,
  promoPending: false,
  promoError: null,
  checkoutKey: null,
  submitting: false,
  error: null,
};

export function loadPersistedCart(): CartState {
  try {
    const raw = globalThis.localStorage?.getItem(CART_STORAGE_KEY);
    if (!raw) return emptyCart;
    const saved = JSON.parse(raw) as Partial<CartState>;
    return {
      ...emptyCart,
      lines: Array.isArray(saved.lines) ? saved.lines : [],
      promo: saved.promo && typeof saved.promo === 'object' ? saved.promo : null,
      checkoutKey: typeof saved.checkoutKey === 'string' ? saved.checkoutKey : null,
    };
  } catch {
    return emptyCart;
  }
}

const clamp = (quantity: number): number => Math.max(0, Math.min(MAX_QUANTITY, Math.floor(quantity)));

const edited = (state: CartState, lines: CartLine[]): CartState => ({
  ...state,
  lines,
  checkoutKey: null,
  error: null,
});

export const createCartReducer = (initialState: CartState): ActionReducer<CartState> =>
  createReducer(
    initialState,
    on(CartActions.addItem, (state, { item, quantity, unitPrice }) => {
      const price = item.openPrice ? (unitPrice ?? 0) : (item.price ?? 0);
      const lineId = lineIdFor(item, price);
      const existing = state.lines.find((line) => line.lineId === lineId);
      const lines = existing
        ? state.lines.map((line) =>
            line === existing ? { ...line, quantity: clamp(line.quantity + quantity) } : line,
          )
        : [
            ...state.lines,
            {
              lineId,
              itemId: item.id,
              name: item.name,
              unitPrice: price,
              openPrice: item.openPrice,
              quantity: clamp(quantity),
            },
          ];
      return edited(state, lines);
    }),
    on(CartActions.setQuantity, (state, { lineId, quantity }) =>
      edited(
        state,
        state.lines
          .map((line) => (line.lineId === lineId ? { ...line, quantity: clamp(quantity) } : line))
          .filter((line) => line.quantity > 0),
      ),
    ),
    on(CartActions.removeLine, (state, { lineId }) =>
      edited(
        state,
        state.lines.filter((line) => line.lineId !== lineId),
      ),
    ),
    on(CartActions.applyPromo, (state): CartState => ({ ...state, promoPending: true, promoError: null })),
    on(CartActions.applyPromoSuccess, (state, { quote }): CartState => ({
      ...edited(state, state.lines),
      promo: quote,
      promoPending: false,
    })),
    on(CartActions.applyPromoFailure, (state, { error }): CartState => ({
      ...state,
      promoPending: false,
      promoError: error,
    })),
    on(CartActions.removePromo, (state): CartState => ({ ...edited(state, state.lines), promo: null, promoError: null })),
    on(CartActions.applyMenuChanges, (state, { items }) =>
      edited(
        state,
        state.lines.flatMap((line): CartLine[] => {
          const item = items[line.itemId];
          const problem = lineProblem(line, item);
          if (!problem || !item) return problem ? [] : [line];
          switch (problem) {
            case 'price_changed':
              return [{ ...line, name: item.name, unitPrice: item.price ?? 0 }];
            case 'open_price_changed':
              return item.openPrice
                ? []
                : [{ ...line, lineId: item.id, openPrice: false, unitPrice: item.price ?? 0 }];
            default:
              return [];
          }
        }),
      ),
    ),
    on(CartActions.clear, () => emptyCart),
    on(CartActions.checkout, (state, { key }) => ({
      ...state,
      checkoutKey: state.checkoutKey ?? key,
      submitting: true,
      error: null,
    })),
    on(CartActions.checkoutSuccess, () => emptyCart),
    on(CartActions.checkoutFailure, (state, { error }) => ({
      ...state,
      submitting: false,
      error,
      ...(error.code.startsWith('PROMO_') ? { promo: null, promoError: error } : {}),
    })),
  );

export const cartFeature = createFeature({
  name: 'cart',
  reducer: createCartReducer(loadPersistedCart()),
});
