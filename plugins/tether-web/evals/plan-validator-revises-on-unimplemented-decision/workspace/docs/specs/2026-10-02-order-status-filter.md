# Order status filter

## Why

Support staff look for shipped or cancelled orders by scrolling the whole list. A status filter kept in the URL lets them share a filtered view.

## Ticket and acceptance criteria

1. A status select above the order list offers All, Open, Shipped and Cancelled; All is the default.
2. Choosing a status reloads the list from `GET /api/orders?status=<status>`; All omits the parameter.
3. The selected status is written to and read from the `status` query parameter, so a shared link opens the same view.
4. While the list reloads, the previous rows stay visible.
5. A status with no orders shows a single line instead of rows.

## Screens and design links

none; the select sits above the existing order list, the empty line takes the rows' place.

## Copy

| Key | en | de |
|---|---|---|
| `orders.orderList.statusFilter.label` | Status | Status |
| `orders.orderList.statusFilter.all` | All | Alle |
| `orders.orderList.statusFilter.open` | Open | Offen |
| `orders.orderList.statusFilter.shipped` | Shipped | Versandt |
| `orders.orderList.statusFilter.cancelled` | Cancelled | Storniert |
| `orders.orderList.empty` | No orders with this status | Keine Bestellungen mit diesem Status |

## Data and API contract

`GET /api/orders?status=open|shipped|cancelled` returns `Order[]` as today; without the parameter it returns every order.

## Placement

The select, its state and the empty line live in the `order-list` slice of `libs/orders/feature`. The API change is on `OrdersApi` in `libs/orders/data-access`, provided by the orders routes as today.

## Decisions

- D1: `OrdersApi.fetchOrders` takes an optional `OrderStatus` and sends it as the `status` query parameter of `GET /api/orders`; All sends no parameter.
- D2: A status select in the `order-list` slice reads and writes the `status` query parameter; the list's `resource` reloads from it and keeps the previous rows while it reloads.
- D3: When the filtered list is empty, the order list shows the `orders.orderList.empty` line instead of rows.

## Tests

A spec beside `orders.api.ts` for the parameter; a spec beside the order list component for the select, the query parameter and the empty line.

## Out of scope

Filtering by anything other than status; remembering the last status between visits.

## Follow-ups

none

## Open decisions

none
