# Plan: Order status filter

Spec: `docs/specs/2026-10-02-order-status-filter.md`.

Every brief starts with this block.

- Verify: `npx nx affected -t lint test build --base={base}`; it passed when every target reports success.
- Commit: `git branch --show-current && git commit --only -m "<message>" -- <paths>`; a created path is `git add`ed first, never `git add -A`, never a bare commit.
- Message: `type(scope): <imperative summary>`, a body with the problem, the approach and the shortcomings; no trailers, no AI attribution in commits or PR bodies.
- Report: `Files:`, `Checks:`, `Deferred:`, `Plan edits:`, or one `Blocked:` line.

## Shared files

- `apps/shop/src/assets/i18n/en.json` and `apps/shop/src/assets/i18n/de.json`, after wave 2: add the five `orders.orderList.statusFilter.*` keys with the values of the spec's Copy table.

## Waves

| Wave | Tasks | Why |
|---|---|---|
| 1 | 1 | Task 2 uses the `fetchOrders(status)` signature from Task 1. |
| 2 | 2 | |

| Task | Shape |
|---|---|
| 1 | new shape |
| 2 | new shape |

### Task 1: [impl] Status parameter on OrdersApi.fetchOrders

```
touches: libs/orders/data-access/src/lib/services/orders.api.ts
conflicts_with: none
spec: D1
checks: verify --projects orders-data-access
```

`OrdersApi.fetchOrders` in `libs/orders/data-access/src/lib/services/orders.api.ts` takes an optional `status: OrderStatus` and passes it as the `status` query parameter through `HttpParams`; without a status it sends no parameter. The provider scope stays the orders routes' `ordersProviders`. A new `orders.api.spec.ts` beside it covers both calls with `HttpTestingController`.

Interfaces: produces `fetchOrders(status?: OrderStatus): Promise<Order[]>`, exported from `@org/orders/data-access` as today.

### Task 2: [impl] Status select on the order list

```
touches: libs/orders/feature/src/lib/order-list/
conflicts_with: none
spec: D2
checks: verify --projects orders-feature
```

In `order-list.component.ts` the status comes from the `status` query parameter through `ActivatedRoute.queryParamMap`, converted with `toSignal`; the select above the list (`data-testid="order-status-select"`) navigates with `queryParams: { status }` and `queryParamsHandling: 'merge'`, and All removes the parameter. The `resource` gets `params: () => this.status()` and its loader calls `fetchOrders(params)`; the template reads `orders.value()` while `orders.isLoading()` so the previous rows stay. Labels use the `orders.orderList.statusFilter.*` keys. A spec beside the component covers the default, a chosen status and a status read from the URL.

Interfaces: uses `fetchOrders(status?: OrderStatus)` from Task 1.

## Click-through

- `/orders?status=shipped`: only shipped orders are listed and the select shows Shipped.
