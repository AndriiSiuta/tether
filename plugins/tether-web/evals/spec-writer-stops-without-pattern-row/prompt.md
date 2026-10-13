---
plugins: ["../..", "../../../tether-nx"]
description: The spec-writer leaves the shape of a new store as an open decision when the codebase has no store to copy, instead of inventing one.
expected_outcome: 'No spec written under docs/specs names an existing file as the shape the new drafts store copies (no "copies the shape of" path and no Placement table row for the store ending in a libs/ path); the returned report lists, under its open decisions, a question about which existing store or pattern the new store copies.'
tags: [spec-writer]
max_turns: 20
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Write]
---

Dispatch the `tether-web:spec-writer` agent with the brief between BEGIN BRIEF and END BRIEF, word for word, and then reply with its report, unchanged.

BEGIN BRIEF
The ticket is the note `docs/tickets/order-drafts.md` in the current working directory, and that directory is the codebase (`libs/`, `apps/`, `tsconfig.base.json`); it has no git history. There is no investigator report. There is no `.claude/tether-web.md` and no `.claude/tether-nx.md`, so the defaults apply. Translation files are `apps/shop/src/assets/i18n/en.json` and `de.json`.

Brainstorm outcome:

- Acceptance criteria: the three in the ticket note, as written.
- Screens: no design. The Drafts section sits below the order rows in the existing `order-list` component (`libs/orders/feature/src/lib/order-list/`); each draft is one row with its customer name, its total and its last change, and a Delete button.
- Copy:

  | Key | en | de |
  |---|---|---|
  | `orders.drafts.title` | Drafts | Entwürfe |
  | `orders.drafts.loading` | Loading drafts | Entwürfe werden geladen |
  | `orders.drafts.empty` | No drafts | Keine Entwürfe |
  | `orders.drafts.error` | Drafts could not be loaded | Entwürfe konnten nicht geladen werden |
  | `orders.drafts.delete` | Delete | Löschen |

- Data contract, served today: `GET /api/order-drafts` returns `OrderDraft[]`, each `{ id: string; customerName: string; total: number; updatedAt: string }` with `updatedAt` an ISO date; `DELETE /api/order-drafts/{id}` returns 204.
- Placement: the drafts live in a new store, `order-drafts.store.ts`, in `libs/orders/data-access/src/lib/store/`, exported from `@org/orders/data-access` and provided by the orders routes' `ordersProviders`; the store loads the drafts and deletes one, so a delete updates the section without a reload. The `OrderDraft` model goes beside `order.model.ts`. The order list component reads the store; it is the only component that changes, and the store and its spec are the only new source files besides the model.
END BRIEF
