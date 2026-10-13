# Order API actions

## Why

The order list is getting a cancel action and a status filter. Both need the API first, so the API work ships on its own.

## Decisions

- D1: `OrdersApi.cancelOrder(id)` sends `POST /api/orders/{id}/cancel` and resolves with the `Order` the response returns.
- D2: `OrdersApi.fetchOrders` takes an optional `OrderStatus` and sends it as the `status` query parameter of `GET /api/orders`; without a status it sends no parameter.

## Ticket and acceptance criteria

1. Cancelling an order calls `POST /api/orders/{id}/cancel` and hands back the cancelled order.
2. Fetching orders with a status calls `GET /api/orders?status=<status>`; fetching without one calls `GET /api/orders`.

## Screens and design links

none; this spec changes no screen.

## Copy

none

## Data and API contract

`POST /api/orders/{id}/cancel` returns the updated `Order`. `GET /api/orders?status=open|shipped|cancelled` returns `Order[]` as today; without the parameter it returns every order. Both are served today.

## Placement

Both changes are on `OrdersApi` in `libs/orders/data-access/src/lib/services/orders.api.ts`, provided by the orders routes as today. No new file other than its spec.

## Tests

A spec beside `orders.api.ts` covers the cancel call and both fetch calls with `HttpTestingController`.

## Out of scope

The cancel button and the status select on the order list; any change to the order list screen.

## Follow-ups

The order list screen work, in its own spec.

## Open decisions

none
