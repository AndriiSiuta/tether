import { Routes } from '@angular/router';

export const ordersRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./order-summary/order-summary.component').then((m) => m.OrderSummaryComponent),
  },
];
