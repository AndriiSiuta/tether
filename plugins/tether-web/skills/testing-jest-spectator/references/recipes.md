# Recipes

Imports are left out: Spectator's helpers (`createComponentFactory`, `createHostFactory`, `createServiceFactory`, `mockProvider`, `byTestId`, `Spectator`) come from `@ngneat/spectator/jest`, `TestBed` from `@angular/core/testing`, the fixtures from the owning lib's barrel (`@org/orders/data-access`).

## Contents

- §1 [A fixture file](#1-a-fixture-file)
- §2 [A component with inputs](#2-a-component-with-inputs)
- §3 [Content projection through a host](#3-content-projection-through-a-host)
- §4 [A heavy child swapped for a stub](#4-a-heavy-child-swapped-for-a-stub)
- §5 [A service with a mocked edge](#5-a-service-with-a-mocked-edge)
- §6 [A signal store with an rxMethod](#6-a-signal-store-with-an-rxmethod)
- §7 [A resource](#7-a-resource)
- §8 [HTTP at the boundary](#8-http-at-the-boundary)
- §9 [A debounced search](#9-a-debounced-search)
- §10 [A dialog and a navigation](#10-a-dialog-and-a-navigation)

## 1. A fixture file

`libs/orders/data-access/src/lib/testing/order.fixtures.ts`, exported from the lib's barrel:

```ts
export function orderItem(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ACME-1001',
    customerName: 'Northwind Traders',
    status: 'open',
    lines: [orderLine()],
    totalMinor: 12_500,
    ...overrides,
  };
}

export function orderLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return { sku: 'SKU-1', quantity: 1, priceMinor: 12_500, ...overrides };
}
```

A nested override spreads the default first: `orderItem({ lines: [orderLine({ quantity: 3 })] })`.

## 2. A component with inputs

```ts
describe('OrderCardComponent', () => {
  const createComponent = createComponentFactory(OrderCardComponent);

  function setup(order: Order = orderItem()): Spectator<OrderCardComponent> {
    return createComponent({ props: { order } });
  }

  it('renders the customer name', () => {
    const spectator = setup();

    expect(spectator.query(byTestId('order-customer'))).toHaveText('Northwind Traders');
  });

  it('shows the shipped badge once the order ships', () => {
    const spectator = setup();

    spectator.setInput('order', orderItem({ status: 'shipped' }));

    expect(spectator.query(byTestId('order-shipped-badge'))).toExist();
  });

  it('emits cancelled with the order id', () => {
    const spectator = setup();
    const cancelled = jest.fn();
    spectator.component.cancelled.subscribe(cancelled);

    spectator.click(byTestId('order-cancel'));

    expect(cancelled).toHaveBeenCalledWith('ACME-1001');
  });
});
```

## 3. Content projection through a host

```ts
describe('InvoicePanelComponent', () => {
  const createHost = createHostFactory(InvoicePanelComponent);

  it('projects the actions slot', () => {
    const spectator = createHost(
      `<acme-invoice-panel [invoice]="invoice"><button data-testid="panel-action">Pay</button></acme-invoice-panel>`,
      { hostProps: { invoice: invoiceItem() } },
    );

    expect(spectator.query(byTestId('panel-action'))).toHaveText('Pay');
  });
});
```

## 4. A heavy child swapped for a stub

```ts
@Component({ selector: 'acme-delivery-map', template: '' })
class DeliveryMapStubComponent {
  readonly route = input<DeliveryRoute>();
}

const createComponent = createComponentFactory({
  component: OrderTrackingComponent,
  overrideComponents: [
    [OrderTrackingComponent, { remove: { imports: [DeliveryMapComponent] }, add: { imports: [DeliveryMapStubComponent] } }],
  ],
});
```

The stub keeps the selector and every bound input, so `errorOnUnknownProperties` still checks the binding.

## 5. A service with a mocked edge

```ts
describe('InvoiceExportService', () => {
  const createService = createServiceFactory({
    service: InvoiceExportService,
    providers: [mockProvider(InvoicesApi, { exportCsv: () => of('id,total\nINV-1,125.00') })],
  });

  it('names the file after the period', () => {
    const spectator = createService();

    expect(spectator.service.fileName({ from: '2026-01-01', to: '2026-01-31' })).toBe('invoices-2026-01.csv');
  });
});
```

## 6. A signal store with an rxMethod

```ts
describe('InvoiceStore', () => {
  function setup(load: InvoicesApi['load']): InstanceType<typeof InvoiceStore> {
    TestBed.configureTestingModule({
      providers: [InvoiceStore, { provide: INVOICES_API, useValue: { load } }],
    });

    return TestBed.inject(InvoiceStore);
  }

  it('holds the invoices the api returns', () => {
    const store = setup(() => of([invoiceItem()]));

    store.load('ACME-1001');

    expect(store.invoices()).toEqual([invoiceItem()]);
  });

  it('is loading until the api answers', () => {
    const response = new Subject<readonly Invoice[]>();
    const store = setup(() => response);

    store.load('ACME-1001');
    expect(store.isLoading()).toBe(true);

    response.next([invoiceItem()]);
    expect(store.isLoading()).toBe(false);
  });

  it('keeps working after a failed load', () => {
    const load = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of([invoiceItem()]));
    const store = setup(load);

    store.load('ACME-1001');
    expect(store.error()).toBe('Invoices could not be loaded');

    store.load('ACME-1001');
    expect(store.invoices()).toHaveLength(1);
  });

  it('reloads when the order signal changes', () => {
    const load = jest.fn(() => of([invoiceItem()]));
    const store = setup(load);
    const orderId = signal('ACME-1001');

    store.load(orderId);
    TestBed.tick();
    orderId.set('ACME-1002');
    TestBed.tick();

    expect(load).toHaveBeenLastCalledWith('ACME-1002');
  });
});
```

## 7. A resource

```ts
it('loads the order for the selected id', async () => {
  TestBed.configureTestingModule({
    providers: [OrderDetailsService, { provide: ORDERS_API, useValue: { get: (id: string) => Promise.resolve(orderItem({ id })) } }],
  });
  const service = TestBed.inject(OrderDetailsService);

  service.selectedId.set('ACME-1002');
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();

  expect(service.order.status()).toBe('resolved');
  expect(service.order.value()?.id).toBe('ACME-1002');
});
```

## 8. HTTP at the boundary

```ts
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [OrdersApi, provideHttpClient(), provideHttpClientTesting()] });
});

afterEach(() => TestBed.inject(HttpTestingController).verify());

it('requests the open orders', async () => {
  const pending = firstValueFrom(TestBed.inject(OrdersApi).open());

  TestBed.inject(HttpTestingController).expectOne('/api/orders?status=open').flush([orderItem()]);

  expect(await pending).toEqual([orderItem()]);
});
```

## 9. A debounced search

```ts
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('searches 300 ms after the last keystroke', () => {
  const search = jest.fn(() => of([]));
  const spectator = createComponent({ providers: [mockProvider(OrdersApi, { search })] });

  spectator.typeInElement('ACME', byTestId('order-search'));
  jest.advanceTimersByTime(299);
  expect(search).not.toHaveBeenCalled();

  jest.advanceTimersByTime(1);
  expect(search).toHaveBeenCalledWith('ACME');
});
```

## 10. A dialog and a navigation

```ts
const createComponent = createComponentFactory({
  component: OrderActionsComponent,
  providers: [provideRouter([]), mockProvider(ConfirmDialogService, { confirm: () => of(true) })],
});

it('opens the invoice after confirming', () => {
  const spectator = createComponent({ props: { order: orderItem() } });
  const navigate = jest.spyOn(spectator.inject(Router), 'navigate').mockResolvedValue(true);

  spectator.click(byTestId('order-invoice'));

  expect(navigate).toHaveBeenCalledWith(['/invoices', 'ACME-1001']);
});
```
