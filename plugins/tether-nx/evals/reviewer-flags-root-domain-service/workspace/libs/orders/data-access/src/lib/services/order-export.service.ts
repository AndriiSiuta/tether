import { Injectable, signal } from '@angular/core';
import { OrderExport } from '../models/order-export.model';

@Injectable({ providedIn: 'root' })
export class OrderExportService {
  private readonly exports = signal<readonly OrderExport[]>([]);
  readonly all = this.exports.asReadonly();

  record(orderId: string, url: string): void {
    this.exports.update((list) => [...list, { orderId, url }]);
  }
}
