import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Order } from '../models/order.model';

@Injectable()
export class OrdersApi {
  private readonly http = inject(HttpClient);

  fetchOrders(): Promise<Order[]> {
    return firstValueFrom(this.http.get<Order[]>('/api/orders'));
  }
}
