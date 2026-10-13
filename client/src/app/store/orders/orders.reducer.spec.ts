import { order } from '../../testing/fixtures';
import { AuthActions } from '../auth/auth.actions';
import { OrdersActions } from './orders.actions';
import { ordersFeature } from './orders.reducer';

const { reducer } = ordersFeature;
const initial = reducer(undefined, { type: 'init' });
const numbered = (n: number): ReturnType<typeof order> => order({ id: `o${n}`, number: n });

describe('orders reducer', () => {
  it('loads the first page and appends older pages', () => {
    let state = reducer(initial, OrdersActions.loadSuccess({ page: { items: [numbered(5), numbered(4)], nextCursor: 4 } }));
    expect(state.nextCursor).toBe(4);

    state = reducer(state, OrdersActions.loadMore());
    expect(state.loadingMore).toBe(true);
    state = reducer(state, OrdersActions.loadMoreSuccess({ page: { items: [numbered(3)], nextCursor: null } }));

    expect(ordersFeature.selectAll.projector(state).map((o) => o.number)).toEqual([5, 4, 3]);
    expect(state).toMatchObject({ loadingMore: false, nextCursor: null });
  });

  it('puts live orders on top and ignores stale updates', () => {
    let state = reducer(initial, OrdersActions.loadSuccess({ page: { items: [numbered(1)], nextCursor: null } }));
    state = reducer(state, OrdersActions.orderUpserted({ order: numbered(2) }));
    expect(ordersFeature.selectAll.projector(state)[0].number).toBe(2);

    const cooking = order({ id: 'o1', number: 1, status: 'COOKING', updatedAt: '2026-01-01T10:05:00.000Z' });
    state = reducer(state, OrdersActions.orderUpserted({ order: cooking }));
    state = reducer(state, OrdersActions.orderUpserted({ order: numbered(1) }));
    expect(state.entities['o1']?.status).toBe('COOKING');
  });

  it('forgets orders on logout', () => {
    const state = reducer(initial, OrdersActions.loadSuccess({ page: { items: [numbered(1)], nextCursor: null } }));
    expect(reducer(state, AuthActions.logoutSuccess()).ids).toEqual([]);
  });
});
