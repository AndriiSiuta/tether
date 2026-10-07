import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { OrdersApi } from '@org/orders/data-access';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'org-order-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './order-list.component.html',
})
export class OrderListComponent {
  private readonly api = inject(OrdersApi);

  readonly orders = resource({ loader: () => this.api.fetchOrders() });
}
