import type { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth.guards';

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
    canActivate: [authGuard],
    loadComponent: () => import('./features/orders/orders-page').then((m) => m.OrdersPage),
  },
  {
    path: 'setup',
    title: 'Menu setup',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/setup/setup-page').then((m) => m.SetupPage),
  },
  {
    path: 'login',
    title: 'Sign in',
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  { path: '**', redirectTo: 'menu' },
];
