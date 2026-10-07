import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OrderSummaryComponent } from '@org/orders/feature';

@Component({
  selector: 'org-invoice-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrderSummaryComponent],
  template: '<org-order-summary />',
})
export class InvoiceListComponent {}
