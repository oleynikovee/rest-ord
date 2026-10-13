import { menuItem } from '../../testing/fixtures';
import { CartActions } from './cart.actions';
import { type CartState, createCartReducer, emptyCart } from './cart.reducer';

const reducer = createCartReducer(emptyCart);
const reduce = (...actions: Parameters<typeof reducer>[1][]): CartState =>
  actions.reduce((state, action) => reducer(state, action), emptyCart);

describe('cart reducer', () => {
  const pizza = menuItem();
  const fish = menuItem({ id: 'fish', name: 'Catch of the day', openPrice: true, price: null });

  it('merges repeated adds of a regular item into one line', () => {
    const state = reduce(
      CartActions.addItem({ item: pizza, quantity: 1 }),
      CartActions.addItem({ item: pizza, quantity: 2 }),
    );
    expect(state.lines).toEqual([
      expect.objectContaining({ itemId: 'pizza', quantity: 3, unitPrice: 1000 }),
    ]);
  });

  it('keeps one line per entered price for open-price items', () => {
    const state = reduce(
      CartActions.addItem({ item: fish, quantity: 1, unitPrice: 2500 }),
      CartActions.addItem({ item: fish, quantity: 1, unitPrice: 3000 }),
      CartActions.addItem({ item: fish, quantity: 1, unitPrice: 2500 }),
    );
    expect(state.lines.map((l) => [l.unitPrice, l.quantity])).toEqual([
      [2500, 2],
      [3000, 1],
    ]);
  });

  it('removes a line when its quantity drops to zero', () => {
    const state = reduce(
      CartActions.addItem({ item: pizza, quantity: 1 }),
      CartActions.setQuantity({ lineId: 'pizza', quantity: 0 }),
    );
    expect(state.lines).toEqual([]);
  });

  it('reuses the pending idempotency key on retry and resets it when the cart changes', () => {
    let state = reduce(
      CartActions.addItem({ item: pizza, quantity: 1 }),
      CartActions.checkout({ key: 'first-key' }),
    );
    expect(state.checkoutKey).toBe('first-key');

    state = reducer(
      state,
      CartActions.checkoutFailure({ error: { status: 0, code: 'NETWORK', message: '' } }),
    );
    state = reducer(state, CartActions.checkout({ key: 'second-key' }));
    expect(state.checkoutKey).toBe('first-key');

    state = reducer(state, CartActions.setQuantity({ lineId: 'pizza', quantity: 2 }));
    expect(state.checkoutKey).toBeNull();
  });

  it('empties the cart after a successful checkout', () => {
    const state = reduce(
      CartActions.addItem({ item: pizza, quantity: 1 }),
      CartActions.checkout({ key: 'key-12345' }),
    );
    expect(reducer(state, CartActions.checkoutSuccess({ order: {} as never }))).toEqual(emptyCart);
  });

  it('applies reviewed menu changes', () => {
    const salad = menuItem({ id: 'salad', name: 'Salad' });
    const soup = menuItem({ id: 'soup', name: 'Soup' });
    const state = reduce(
      CartActions.addItem({ item: pizza, quantity: 1 }),
      CartActions.addItem({ item: salad, quantity: 1 }),
      CartActions.addItem({ item: soup, quantity: 1 }),
      CartActions.applyMenuChanges({
        items: {
          pizza: { ...pizza, price: 1200, version: 2 },
          salad: { ...salad, available: false },
          soup: undefined,
        },
      }),
    );
    expect(state.lines).toEqual([expect.objectContaining({ itemId: 'pizza', unitPrice: 1200 })]);
  });

  it('applies a promo code and drops it when the server refuses it at checkout', () => {
    const quote = {
      rule: { code: 'SAVE5', kind: 'FIXED' as const, value: 500, minOrderAmount: 3000, maxDiscount: null },
      description: '$5 off',
      discount: 500,
    };
    let state = reduce(CartActions.addItem({ item: pizza, quantity: 1 }), CartActions.applyPromo({ code: 'save5' }));
    expect(state.promoPending).toBe(true);
    state = reducer(state, CartActions.applyPromoSuccess({ quote }));
    expect(state).toMatchObject({ promo: quote, promoPending: false });

    state = reducer(
      state,
      CartActions.checkoutFailure({ error: { status: 422, code: 'PROMO_EXHAUSTED', message: 'Used up' } }),
    );
    expect(state).toMatchObject({ promo: null, promoError: { code: 'PROMO_EXHAUSTED' } });
  });
});
