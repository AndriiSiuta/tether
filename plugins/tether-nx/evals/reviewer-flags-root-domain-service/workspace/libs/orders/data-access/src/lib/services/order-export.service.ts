import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OrderExport } from '../models/order-export.model';

@Injectable({ providedIn: 'root' })
export class OrderExportService {
  private readonly http = inject(HttpClient);

  fetchExport(orderId: string): Promise<OrderExport> {
    return firstValueFrom(this.http.get<OrderExport>(`/api/orders/${orderId}/export`));
  }
}
