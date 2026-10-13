import type { Routes } from '@angular/router';

/** Every page is lazy-loaded so the initial bundle stays small. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'menu' },
  {
    path: 'menu',
    title: 'Menu',
    loadComponent: () => import('./features/menu/menu-page').then((m) => m.MenuPage),
  },
  {
    path: 'orders',
    title: 'Orders',
    loadComponent: () => import('./features/orders/orders-page').then((m) => m.OrdersPage),
  },
  {
    path: 'setup',
    title: 'Menu setup',
    loadComponent: () => import('./features/setup/setup-page').then((m) => m.SetupPage),
  },
  { path: '**', redirectTo: 'menu' },
];
