import { BreakpointObserver } from '@angular/cdk/layout';
import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import type { MenuItem } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';
import { CartActions } from '../../store/cart/cart.actions';
import { cartFeature } from '../../store/cart/cart.reducer';
import {
  selectCartCount,
  selectQuantityByItem,
  selectTotal,
} from '../../store/cart/cart.selectors';
import { MenuActions } from '../../store/menu/menu.actions';
import { menuFeature } from '../../store/menu/menu.reducer';
import { selectCategories, selectMenuSections } from '../../store/menu/menu.selectors';
import { CartPanel } from './cart-panel';
import { MenuItemRow } from './menu-item-row';
import { OpenPriceDialog, type OpenPriceResult } from './open-price-dialog';

type Row =
  | { kind: 'header'; id: string; name: string; count: number }
  | { kind: 'item'; id: string; item: MenuItem };

export const ROW_HEIGHT = 72;

@Component({
  selector: 'app-menu-page',
  templateUrl: './menu-page.html',
  styleUrl: './menu-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollingModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSidenavModule,
    MoneyPipe,
    CartPanel,
    MenuItemRow,
  ],
})
export class MenuPage {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly wide = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 1024px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly cartOpen = signal(false);

  protected readonly loaded = this.store.selectSignal(menuFeature.selectLoaded);
  protected readonly loadError = this.store.selectSignal(menuFeature.selectError);
  protected readonly categories = this.store.selectSignal(selectCategories);
  private readonly sections = this.store.selectSignal(selectMenuSections);
  protected readonly quantities = this.store.selectSignal(selectQuantityByItem);
  protected readonly cartCount = this.store.selectSignal(selectCartCount);
  protected readonly cartTotal = this.store.selectSignal(selectTotal);
  private readonly cartLines = this.store.selectSignal(cartFeature.selectLines);

  protected readonly search = signal('');
  protected readonly categoryId = signal<string | null>(null);

  /** Headers and items flattened into one list of equal-height rows for virtual scrolling. */
  protected readonly rows = computed<Row[]>(() => {
    const query = this.search().trim().toLowerCase();
    const categoryId = this.categoryId();
    const rows: Row[] = [];
    for (const { category, items } of this.sections()) {
      if (categoryId && category.id !== categoryId) continue;
      const matching = query
        ? items.filter((item) => item.name.toLowerCase().includes(query))
        : items;
      if (matching.length === 0) continue;
      rows.push({
        kind: 'header',
        id: `h:${category.id}`,
        name: category.name,
        count: matching.length,
      });
      for (const item of matching) rows.push({ kind: 'item', id: item.id, item });
    }
    return rows;
  });

  protected readonly skeletonRows = Array.from({ length: 12 }, (_, i) => i);

  protected trackRow = (_: number, row: Row) => row.id;

  protected retry(): void {
    this.store.dispatch(MenuActions.load());
  }

  protected selectCategory(id: string | null): void {
    this.categoryId.set(id);
  }

  protected add(item: MenuItem): void {
    if (!item.openPrice) {
      this.store.dispatch(CartActions.addItem({ item, quantity: 1 }));
      return;
    }
    this.dialog
      .open<OpenPriceDialog, MenuItem, OpenPriceResult>(OpenPriceDialog, {
        data: item,
        width: '360px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) this.store.dispatch(CartActions.addItem({ item, ...result }));
      });
  }

  /** Regular items have exactly one cart line, keyed by item id. */
  protected setQuantity(item: MenuItem, quantity: number): void {
    const line = this.cartLines().find((l) => l.itemId === item.id && !l.openPrice);
    if (line) this.store.dispatch(CartActions.setQuantity({ lineId: line.lineId, quantity }));
  }
}
