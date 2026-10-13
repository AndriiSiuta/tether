# Investigation: recurring fixed fee on project invoices — YYYY-MM-DD
Ask: a project's invoice should carry a fixed recurring fee (for example a licence fee) on every billing period, from the period's start day.
Verdict: needs spec change

## Files
| Layer | File | Role | Touch |
|---|---|---|---|
| shared | `libs/projects/data-access/src/lib/models/project.model.ts` | `Project` type, billing settings | edit |
| shared | `libs/invoices/data-access/src/lib/models/invoice.model.ts` | `InvoiceLine` union, api → web boundary | edit |
| shared | `libs/shared/util/src/lib/utils/billing-period.ts` | `billingPeriod(today, startDay)` | read |
| api | `apps/api/src/projects/project.validation.ts` | billing settings validation, defaults | edit |
| api | `apps/api/src/projects/project.entity.ts` | billing settings stored as JSON, no migration path | read |
| api | `apps/api/src/invoices/invoice-lines.ts` | `invoiceLines()` builds the lines and `total` | edit |
| api | `apps/api/src/invoices/invoices.service.ts` | loads orders per period, calls `invoiceLines` | read |
| api | `apps/api/src/orders/orders.service.ts` | order ledger, `sumForPeriod` unused | if B |
| web | `libs/projects/feature/src/lib/project-edit/billing-form.component.ts` | billing field group and inline validation | edit |
| web | `libs/projects/feature/src/lib/project-edit/project-edit.component.ts` | `blankBilling()` default shape | edit |
| web | `libs/invoices/data-access/src/lib/services/invoices-store.service.ts` | recomputes `total` on an optimistic edit | edit |
| web | `libs/invoices/feature/src/lib/invoice-details/invoice-details.component.ts` | invoice page, lines and total | edit |
| web | `libs/reports/feature/src/lib/revenue-report/revenue-summary.component.ts` | report summary line | edit |
| docs | `docs/specs/invoices.md` §3, §6 | invoice line table, `total` formula | edit |
| docs | `docs/plans/invoices-follow-ups.md` | "zero-total invoice is fine as is" | read |

## Flow
Invoice page / revenue report → `invoice-details` / `revenue-summary` → `GET /api/invoices/:id` → `InvoicesService.get` → `invoiceLines(project, orders, period)` → `billingPeriod` → `Invoice` → renders lines, `total`, `periodEnd`.
Edit: `billing-form` → `project-edit` → `ProjectsApi.update` → `PUT /api/projects/:id/billing` → `normalizeBilling` → JSON column; `InvoicesStore` patches `total` locally meanwhile.

## Reuse (exists, do not reinvent)
- `billingPeriod` in `billing-period.ts` — period bounds from the start day
- `amount()`, `integer()` in `project.validation.ts` — numeric field validators to copy
- `invoiceLines()` — the single place the server computes `total`

## Constraints
- An invoice total is never negative; a credit is its own document — `docs/specs/invoices.md` §6
- Every invoice change surfaces in the revenue report — `revenue-summary.component.ts`
- Billing settings are JSON; old rows lack any new field, so every consumer must default it — `project.entity.ts`

## Risks
- `total` is computed in two places (`invoice-lines.ts`, `invoices-store.service.ts`); they drift if only one changes
- The fee label is duplicated in `invoice-details` and `revenue-summary`
- Period-boundary math has no spec; it is verified by hand only

## Open questions (≤3)
- Is the recurring fee a field on the project, or an order row created each period?
- Does a project with no orders in a period still get an invoice for the fee alone?
- Is the fee charged in full on the period's start day, or prorated for a project that starts mid-period?
