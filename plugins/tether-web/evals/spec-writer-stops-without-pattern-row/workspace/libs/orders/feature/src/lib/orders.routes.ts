import { Routes } from '@angular/router';
import { OrdersApi } from '@org/orders/data-access';

export const ordersProviders = [OrdersApi];

export const ordersRoutes: Routes = [
  {
    path: '',
    providers: ordersProviders,
    children: [
      {
        path: '',
        loadComponent: () => import('./order-list/order-list.component').then((m) => m.OrderListComponent),
      },
    ],
  },
];
