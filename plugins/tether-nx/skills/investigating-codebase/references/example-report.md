# Investigation: recurring fixed amount on budget blocks — 2026-01-08
Ask: a budget block should subtract a fixed recurring amount (e.g. a licence fee of 900 €) every period, from the reset day.
Verdict: needs spec change

## Files
| Layer | File | Role | Touch |
|---|---|---|---|
| shared | `libs/shared/src/project.ts` | `BudgetBlock` type, `PROJECT_PRESETS.operations` | edit |
| shared | `libs/shared/src/dashboard.ts` | `BlockState` budget variant, api → web boundary | edit |
| shared | `libs/shared/src/dates.ts` | `budgetPeriod(today, resetDay)` | read |
| api | `apps/api/src/projects/blocks.validation.ts` | per-kind block validation, defaults | edit |
| api | `apps/api/src/projects/project.schema.ts` | `blocks` stored as Mixed, no migration path | read |
| api | `apps/api/src/dashboard/block-state.ts` | `budgetState()` computes `spent`, `left` | edit |
| api | `apps/api/src/dashboard/dashboard.service.ts` | loads expenses per period, calls `blockState` | read |
| api | `apps/api/src/expenses/expenses.service.ts` | expense ledger, `sumForPeriod` unused | if B |
| web | `apps/web/src/app/ui/blocks/block-form.component.ts` | budget field group + inline validation | edit |
| web | `apps/web/src/app/pages/project/edit-blocks-dialog.component.ts` | `blank('budget')` default shape | edit |
| web | `apps/web/src/app/data/dashboard.store.ts` | `restate()` recomputes `left` on optimistic edit | edit |
| web | `apps/web/src/app/ui/blocks/budget-full.component.ts` | project-page view, headline, meter | edit |
| web | `apps/web/src/app/ui/blocks/budget-summary.component.ts` | dashboard-card summary line | edit |
| docs | `docs/superpowers/specs/2026-01-07-v2-design.md` §4, §10 | block fields table, `left` formula | edit |
| docs | `docs/superpowers/plans/2026-01-07-v2-follow-ups.md` | "amount 0 → set your budget" is fine as is | read |

## Flow
Dashboard card / project page → `budget-summary` / `budget-full` (`state()` input) → `GET /api/dashboard` → `DashboardService.get` → `blockState` → `budgetState(block, expenses, today)` → `budgetPeriod` → `BlockState` → renders `left`, `spent`, `periodEnd`.
Edit: `block-form` → `edit-blocks-dialog` → `ProjectsStore` → `PUT /api/projects/:slug/blocks` → `normalizeBlocks` → Mixed array in Mongo; `DashboardStore.restate` patches `left` locally meanwhile.

## Reuse (exists, do not reinvent)
- `budgetPeriod` in `libs/shared/src/dates.ts` — period bounds from the reset day
- `amount()`, `integer()` in `blocks.validation.ts` — numeric field validators to copy
- `budgetState()` — the single place `left` is computed server-side

## Constraints
- Product rules: no red badges or "over" shaming; attention only when `amount > 0 && left < 0` — CLAUDE.md rule 7, follow-ups "fine as is"
- Every project feature surfaces on the dashboard card — CLAUDE.md rule 7, `budget-summary.component.ts`
- `MAX_BLOCKS = 4`, `resetDay` 1–28 — `libs/shared/src/project.ts`, `blocks.validation.ts`
- Blocks are Mixed; old documents lack any new field, every consumer must default it — `project.schema.ts`

## Risks
- `left` is computed in two places (`block-state.ts`, `dashboard.store.ts` `restate`); they drift if only one changes
- "Over" copy is duplicated in `budget-full` and `budget-summary`; backlog already flags copy dedupe
- No automated tests; period-boundary math is verified by hand only

## Open questions (≤3)
- Is the recurring amount a field on the block, or a expense row auto-created each period?
- Does a block with `amount` 0 and a recurring amount count as "set", and can it trigger "over"?
- Is the amount counted in full on the reset day, or spread across the period?
