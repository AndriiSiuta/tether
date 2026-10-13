import { Routes } from '@angular/router';

export const ordersProviders = [];

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
