---
plugins: ["../..", "../../../tether-nx"]
description: The code reviewer marks a cited decision the change does not implement as missing and an edit outside touches as a major extra.
expected_outcome: 'The returned table has a SPEC row marking D2 missing and a SPEC extra row of severity major for order-list.component.html, which lies outside touches; the final line is `Verdict: fail` and no `Verdict: pass` appears.'
tags: [smoke, code-reviewer]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Agent, Read, Glob, Grep]
---

Dispatch the `tether-web:code-reviewer` agent with the brief between BEGIN BRIEF and END BRIEF, word for word, and then reply with the review it returns, unchanged.

BEGIN BRIEF
Review the change Task 1 below produced. The current working directory is the codebase after the change (`libs/`, `tsconfig.base.json`); it has no git history, so the change is the patch `changes/task-1.diff` in that directory. The spec is `docs/specs/2026-10-05-order-api-actions.md`; its `## Decisions` list holds D1 and D2. There is no `.claude/tether-web.md`, no `.claude/tether-nx.md` and no `.claude/constitution.md`, so the defaults apply. There is no verify command output for this change.

### Task 1: [impl] Cancel and status parameter on OrdersApi

```
touches: libs/orders/data-access/src/lib/services/orders.api.ts, libs/orders/data-access/src/lib/services/orders.api.spec.ts
conflicts_with: none
spec: D1, D2
checks: verify --projects orders-data-access
```

`OrdersApi` in `libs/orders/data-access/src/lib/services/orders.api.ts` gains `cancelOrder(id: string): Promise<Order>`, and `fetchOrders` takes an optional `status: OrderStatus` passed as the `status` query parameter through `HttpParams`. A new `orders.api.spec.ts` beside it covers the cancel call and both fetch calls with `HttpTestingController`. The provider scope stays the orders routes' `ordersProviders`.
END BRIEF
