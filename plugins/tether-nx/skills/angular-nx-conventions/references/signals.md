# Signals over RxJS

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

This expands `SIG-1`…`SIG-4` for new code. Existing Observable pipelines and stores stay as they are until a planned migration rewrites them; they are not rewritten in passing.

## The contract

- `SIG-1`: data loading is `computed()` params → `resource({ params, loader })` → async service methods returning Promises. `linkedSignal` keeps the previous value across a params change.
- `SIG-2`: no `toObservable` bridge, no Subject + switchMap pipeline, no Observable-returning service method, no bare signal read inside `effect()` for dependency tracking, no `subscribe` inside an `effect()`.
- `SIG-3`: RxJS is for timers, DOM events and value-less event buses. `firstValueFrom` around `HttpClient` is fine inside the service, since `HttpClient` carries the interceptors.
- `SIG-4`: new state is a signal service. An existing store stays in its domain's data-access library and is not extended with new state.

## Reference shape

```ts
@Injectable()
export class OrderTotalsService {
  private readonly http = inject(HttpClient);

  async load(orderId: number, day: string): Promise<OrderTotals> {
    return firstValueFrom(this.http.get<OrderTotals>(`/api/orders/${orderId}/totals`, { params: { day } }));
  }
}

@Component({
  selector: 'app-order-totals-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-totals-chart.component.html',
})
export class OrderTotalsChartComponent {
  private readonly orderTotals = inject(OrderTotalsService);

  readonly orderId = input.required<number>();
  readonly day = signal(todayIso());

  private readonly params = computed(() => ({ orderId: this.orderId(), day: this.day() }));

  readonly totals = resource({
    params: this.params,
    loader: ({ params }) => this.orderTotals.load(params.orderId, params.day),
  });

  readonly lastTotals = linkedSignal<OrderTotals | undefined, OrderTotals | undefined>({
    source: () => (this.totals.hasValue() ? this.totals.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });

  readonly view = computed<TotalsView>(() => {
    const totals = this.lastTotals();
    if (this.totals.status() === 'error') return { kind: 'error', error: this.totals.error() };
    if (totals === undefined) return { kind: 'loading' };
    return { kind: 'ready', totals };
  });
}
```

`value()` throws while the resource is in the error state, so the `linkedSignal` source reads it only behind `hasValue()`; the `undefined` lives at that one edge. The template switches on `view().kind` (`loading | ready | error`, plus `empty` for a list), never on a boolean derived from `!== undefined`, and the chart keeps drawing the previous day while the next one is in flight. A plain `reload()` keeps its value on its own, so the `linkedSignal` is only for a params change. The service returns a model type, not the raw payload, when the two differ; `OrderTotals` and `TotalsView` live in sibling `*.model.ts` files (`CMP-2`). `OrderTotalsService` is listed in `ordersProviders` (`DI-1`, `DI-2`).

## Allowed RxJS

Each category below may stay Observable; anything else is a rewrite request in review, not a style preference.

- Timers: `interval`, `timer`, one-shot animation timers.
- DOM and CDK events: `fromEvent`, overlay keyboard and backdrop events, breakpoint observers.
- Dialog results whose handler is UI-only. When the result triggers an HTTP write, the handler is `async` and `await`s `firstValueFrom` of the close event, then the Promise method.
- Form `valueChanges` and `statusChanges` that only mutate the form or emit an output. When the value drives a load, `toSignal(control.valueChanges, { initialValue })` feeds a `resource`.
- Authentication library event streams.
- Live-data stream consumers and their transport: every message is an event, and a signal would coalesce a burst.
- Event buses that hold no value: a "something happened" notification, a toast request, a "range committed" event. A held value (a selection, a filter set, a settings version, an error message) is a signal, never a bus.
- Router event streams in a service that consumes them as events. A component that needs the current URL reads it in a `computed`; a route param is an `input()`.
- `firstValueFrom` inside a service, and the action pipelines of an existing store.

Never: `toObservable`, `toSignal` over a hand-built pipeline, a `BehaviorSubject` as component state, `switchMap` over user input, a `subscribe` inside an `effect()`.

## Routed records

A screen's record is not loaded by a resolver; no new resolver class or `ResolveFn` is written. With `withComponentInputBinding()` in the router configuration, the route param arrives as an `input()`, and the record is a `resource` keyed on it:

```ts
export class OrderDetailsComponent {
  private readonly orders = inject(OrdersApi);

  readonly orderId = input.required<string>();

  private readonly id = computed(() => Number(this.orderId()));

  readonly order = resource({
    params: this.id,
    loader: ({ params }) => this.orders.fetchOrder(params),
  });
}
```

The component renders the loading and error states itself, so navigation completes at once. A follow-up load keyed on the ready record (the order's invoices) is another `resource` whose params are a `computed` that returns `undefined` until the record is ready, never a `subscribe` inside an effect. An effect that reacts to the ready record runs its body `untracked` and is idempotent. Where the screen must stay mounted across a param change, `linkedSignal` holds the last ready record.
