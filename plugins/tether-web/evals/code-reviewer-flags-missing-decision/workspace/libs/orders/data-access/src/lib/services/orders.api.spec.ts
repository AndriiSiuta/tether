import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Order } from '../models/order.model';
import { OrdersApi } from './orders.api';

describe('OrdersApi', () => {
  const cancelled: Order = { id: 'o-1', status: 'cancelled', total: 120 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OrdersApi, provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('cancels an order and resolves with the updated order', async () => {
    const api = TestBed.inject(OrdersApi);
    const http = TestBed.inject(HttpTestingController);

    const result = api.cancelOrder('o-1');
    const request = http.expectOne('/api/orders/o-1/cancel');
    expect(request.request.method).toBe('POST');
    request.flush(cancelled);

    await expect(result).resolves.toEqual(cancelled);
    http.verify();
  });
});
