# Order export to CSV

Date: 2026-10-01 · Status: agreed · Amends: none

## Why

Support staff copy orders into a spreadsheet by hand for the monthly reconciliation. Today the order list can only be read on screen. After this change the list offers a CSV download of the orders the current status filter shows.

## Ticket and acceptance criteria

No ticket; the request came from the support lead in the brief.

1. An Export CSV button sits above the order list, beside the status filter.
2. The download holds the orders the current filter shows, one row per order: id, status, total.
3. The file is named `orders-<status>-<YYYY-MM-DD>.csv`; All gives `orders-all-<YYYY-MM-DD>.csv`.
4. While the file is prepared the button is disabled and reads "Exporting…".
5. A failed export shows an error line under the button; the list stays as it was.

## Screens and design links

- `/orders`: the button appears right of the status filter; the error line appears under it. No design frame; the button reuses the list's secondary button style.

## Copy

| Key | en | de |
|---|---|---|
| `orders.orderList.export.button` | Export CSV | CSV exportieren |
| `orders.orderList.export.busy` | Exporting… | Wird exportiert… |
| `orders.orderList.export.error` | The export failed. Try again. | Der Export ist fehlgeschlagen. Bitte erneut versuchen. |

No string is removed.

## Data and API contract

| Field | Type | Source |
|---|---|---|
| `status` | `OrderStatus`, optional | the `status` query parameter, as the filter writes it |
| CSV body | text, `text/csv` | `GET /api/orders/export?status=<status>` (served today; All omits the parameter) |

## Placement

The export call joins `OrdersApi` in `libs/orders/data-access` (`NX-1`), provided by the orders routes as today (`DI-2`). The button, its busy flag and the error line are component state in the `order-list` slice of `libs/orders/feature` (`FEAT-1`, `SIG-4`); no store. No feature flag.

| New file | Library and folder | Copies the shape of |
|---|---|---|
| `order-export.util.ts` and its spec | `@org/orders/util` (`NX-3`), `lib/` | `libs/orders/util/src/lib/order-status.util.ts` |

## Decisions

1. D1: `OrdersApi.exportCsv(status?)` calls `GET /api/orders/export` and returns the body as text; All sends no parameter.
2. D2: The export reads the status from the same query parameter the filter writes; it never keeps a copy.
3. D3: The file name comes from one pure helper taking the status and the date, with its own spec.
4. D4: The button is disabled and shows the busy label from click until the download starts or fails.
5. D5: A failure shows the error line until the next click; nothing is retried on its own.

## Tests

- Criteria 1, 4, 5: the order list component spec (button, busy label, error line).
- Criterion 2: the `orders.api.ts` spec (the `status` parameter, none for All).
- Criterion 3: the file-name helper's spec.
- The order list spec gains an `OrdersApi` stub for `exportCsv`.

## Out of scope

Export formats other than CSV; choosing columns; exporting more than the filtered list.

## Follow-ups

- Cancelled orders are exported like the others; product to confirm they belong in the reconciliation.

## Open decisions

1. Totals in the CSV: minor units as served (exact, needs a spreadsheet formula) or formatted with two decimals (readable, locale-dependent separator).

## Diagram

none
