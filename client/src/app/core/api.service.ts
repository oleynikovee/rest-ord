import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, retry, timer } from 'rxjs';
import type {
  Category,
  CreateOrderRequest,
  MenuItem,
  MenuItemInput,
  MenuSnapshot,
  Order,
} from './models';

/** Retries idempotent GETs on network / gateway errors with exponential backoff. */
const retryReads = <T>() =>
  retry<T>({
    count: 3,
    delay: (error: { status?: number }, attempt) => {
      if (error.status !== undefined && error.status !== 0 && error.status < 502) throw error;
      return timer(500 * 2 ** (attempt - 1));
    },
  });

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  getMenu(): Observable<MenuSnapshot> {
    return this.http.get<MenuSnapshot>('/api/menu').pipe(retryReads());
  }

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>('/api/orders').pipe(retryReads());
  }

  placeOrder(request: CreateOrderRequest, idempotencyKey: string): Observable<Order> {
    return this.http.post<Order>('/api/orders', request, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  createCategory(name: string): Observable<Category> {
    return this.http.post<Category>('/api/categories', { name });
  }

  updateCategory(id: string, name: string): Observable<Category> {
    return this.http.patch<Category>(`/api/categories/${id}`, { name });
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`/api/categories/${id}`);
  }

  createItem(input: MenuItemInput): Observable<MenuItem> {
    return this.http.post<MenuItem>('/api/items', input);
  }

  updateItem(id: string, changes: Partial<MenuItemInput>): Observable<MenuItem> {
    return this.http.patch<MenuItem>(`/api/items/${id}`, changes);
  }

  deleteItem(id: string): Observable<void> {
    return this.http.delete<void>(`/api/items/${id}`);
  }
}
