export type OrderStatus = 'open' | 'shipped' | 'cancelled';

export interface Order {
  readonly id: string;
  readonly status: OrderStatus;
  readonly total: number;
}
