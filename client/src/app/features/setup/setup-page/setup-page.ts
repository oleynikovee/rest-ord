import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import type { MenuItem, MenuItemInput } from '../../../core/models';
import { ConfirmDialog, type ConfirmData } from '../../../shared/confirm-dialog/confirm-dialog';
import { MoneyPipe } from '../../../shared/money.pipe';
import { PromptDialog, type PromptData } from '../../../shared/prompt-dialog/prompt-dialog';
import { MenuActions, SetupActions } from '../../../store/menu/menu.actions';
import { menuFeature } from '../../../store/menu/menu.reducer';
import { selectCategories, selectMenuSections } from '../../../store/menu/menu.selectors';
import { ItemDialog, type ItemDialogData } from '../item-dialog/item-dialog';

@Component({
  selector: 'app-setup-page',
  templateUrl: './setup-page.html',
  styleUrl: './setup-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MoneyPipe,
  ],
})
export class SetupPage {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loaded = this.store.selectSignal(menuFeature.selectLoaded);
  protected readonly loadError = this.store.selectSignal(menuFeature.selectError);
  protected readonly categories = this.store.selectSignal(selectCategories);
  private readonly sections = this.store.selectSignal(selectMenuSections);

  private readonly selectedId = signal<string | null>(null);
  protected readonly search = signal('');

  protected readonly selected = computed(() => {
    const categories = this.categories();
    return categories.find((c) => c.id === this.selectedId()) ?? categories[0] ?? null;
  });

  protected readonly items = computed(() => {
    const selected = this.selected();
    const query = this.search().trim().toLowerCase();
    const items = this.sections().find((s) => s.category.id === selected?.id)?.items ?? [];
    return query ? items.filter((i) => i.name.toLowerCase().includes(query)) : items;
  });

  protected select(id: string): void {
    this.selectedId.set(id);
  }

  protected retry(): void {
    this.store.dispatch(MenuActions.load());
  }

  protected addCategory(): void {
    this.prompt({ title: 'New category', label: 'Name', confirm: 'Create' }, (name) =>
      this.store.dispatch(SetupActions.createCategory({ name })),
    );
  }

  protected renameCategory(): void {
    const category = this.selected();
    if (!category) return;
    this.prompt(
      { title: 'Rename category', label: 'Name', value: category.name, confirm: 'Save' },
      (name) => this.store.dispatch(SetupActions.renameCategory({ category, name })),
    );
  }

  protected deleteCategory(): void {
    const category = this.selected();
    if (!category) return;
    this.confirm(
      {
        title: `Delete “${category.name}”?`,
        message: 'Only empty categories can be deleted.',
        confirm: 'Delete',
      },
      () => this.store.dispatch(SetupActions.deleteCategory({ category })),
    );
  }

  protected addItem(): void {
    const category = this.selected();
    if (!category) return;
    this.openItemDialog({ categories: this.categories(), categoryId: category.id }, (input) =>
      this.store.dispatch(SetupActions.createItem({ input })),
    );
  }

  protected editItem(item: MenuItem, overrides?: Partial<MenuItemInput>): void {
    this.openItemDialog(
      { categories: this.categories(), categoryId: item.categoryId, item, overrides },
      (changes) => this.store.dispatch(SetupActions.updateItem({ previous: item, changes })),
    );
  }

  protected setAvailable(item: MenuItem, available: boolean): void {
    this.store.dispatch(SetupActions.updateItem({ previous: item, changes: { available } }));
  }

  protected setOpenPrice(item: MenuItem, openPrice: boolean): void {
    if (!openPrice && item.price === null) {
      this.editItem(item, { openPrice: false });
      return;
    }
    this.store.dispatch(SetupActions.updateItem({ previous: item, changes: { openPrice } }));
  }

  protected deleteItem(item: MenuItem): void {
    this.confirm(
      {
        title: `Delete “${item.name}”?`,
        message: 'It disappears from the menu immediately.',
        confirm: 'Delete',
      },
      () => this.store.dispatch(SetupActions.deleteItem({ item })),
    );
  }

  private prompt(data: PromptData, then: (value: string) => void): void {
    this.dialog
      .open<PromptDialog, PromptData, string>(PromptDialog, { data })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => value && then(value));
  }

  private confirm(data: ConfirmData, then: () => void): void {
    this.dialog
      .open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && then());
  }

  private openItemDialog(data: ItemDialogData, then: (input: MenuItemInput) => void): void {
    this.dialog
      .open<ItemDialog, ItemDialogData, MenuItemInput>(ItemDialog, { data, maxWidth: '95vw' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((input) => input && then(input));
  }
}
