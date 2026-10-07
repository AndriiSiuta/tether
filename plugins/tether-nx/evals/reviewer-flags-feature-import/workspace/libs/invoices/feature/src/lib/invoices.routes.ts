import { Routes } from '@angular/router';

export const invoicesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./invoice-list/invoice-list.component').then((m) => m.InvoiceListComponent),
  },
];
