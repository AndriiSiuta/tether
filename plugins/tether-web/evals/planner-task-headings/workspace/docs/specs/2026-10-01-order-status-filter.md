# Order status filter

## Goal

On the order list, a user filters orders by status (open, shipped, cancelled). The filter is kept in the URL query (`?status=shipped`), so a shared link opens the same view.

## Acceptance criteria

1. A status select above the order list offers All, Open, Shipped and Cancelled; All is the default.
2. Choosing a status reloads the list from `GET /api/orders?status=<status>`; All omits the parameter.
3. The selected status is written to and read from the `status` query parameter.
4. While the list reloads, the previous rows stay visible.
5. Every new label is a translation key in `en.json` and `de.json`.

## Data contract

`GET /api/orders?status=open|shipped|cancelled` returns `Order[]` as today.

## Placement

The select and its state live in the `order-list` slice of `libs/orders/feature`. The API call is a new Promise method on `OrdersApi` in `libs/orders/data-access`.
