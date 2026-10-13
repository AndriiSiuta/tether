---
name: constitution
description: Use when planning, validating, implementing or reviewing web front-end work — a plan task that might break a non-negotiable, a review finding that needs a rule id, a brief that asks for something a project rule forbids, a project that wants to change or waive a default — and when someone asks what the project will not relitigate.
---

# Constitution

Read `.claude/tether-web.md` first; where it differs from this file, it wins.

## Overview

A constitution is the short list of non-negotiables a project will not relitigate: rules already ruled on, written once so no plan, brief or review argues them again. Each has a stable id `CON-<n>`; plans, verdicts and review rows cite the id, never the prose.

It is not a style guide. A rule belongs here only when breaking it sends a change back regardless of the rest; everything else lives in `tether-nx:angular-nx-conventions` and `tether-nx:typescript-style`.

## Where it lives

| Situation | Constitution in force |
|---|---|
| The rules file sets `constitution: <path>` | That file, read on top of the default set |
| No key, `.claude/constitution.md` exists | That file, read on top of the default set |
| Neither exists | The default set in `references/default-constitution.md` |

The project file uses the default set's columns (`Id | Rule | Check`). A matching id replaces the default; a default it does not name still applies; a new rule takes the next free id (`CON-11`, …).

```markdown
| Id | Rule | Check |
|---|---|---|
| CON-9 | waived: mid-migration off the legacy dialog service; a new dialog may wrap it until then | — |
| CON-11 | Money is an integer in minor units from the API to the template; only the currency pipe formats it | `toFixed(`, `/ 100` in a touched file |
```

**Ids are stable.** Never renumbered or reused. A dropped rule stays as `waived: <reason>`; deleting the row brings the default back.

## How each agent applies it

| Agent | Does |
|---|---|
| `planner` | Plans to it. A task that cannot meet an id goes to the user as an open decision before the plan is written. |
| `plan-validator` | A task that implies a breach gets a row citing the id and `Verdict: Revise`. |
| `implementer`, `implementer-mechanical` | Follow it without argument. A brief that needs a breach stops with `Blocked: CON-<n> — <why>`; the implementer never grants the exception. |
| `conventions-reviewer` | Cites the id in the Rule column, `path:line` and a one-line reason as Evidence. |
| `code-reviewer` | Names the id when a finding is also a breach. |
| The dispatcher | Refutes a finding citing an unknown or waived id. |

A cited row looks like:

```markdown
| CON-2 | Fail | `libs/invoices/data-access/src/lib/invoice-total.util.ts:14` — `discount != null` compares against null; use `isNonNullish(discount)` |
```

## Changing the constitution

- A project changes a rule in its own file: replace the row or mark it `waived: <reason>`. Never silently ignore an id.
- A ruling that recurs in two reviews is a candidate: propose a draft row to the user; never add it yourself.
- Long reasoning goes in an ADR (`tether-web:writing-adr`) the row links to.

## Common mistakes

- **Prose instead of ids.** "Avoid loops" in a review row; write `CON-1` and the line.
- **Arguing the rule.** "A `for` loop is clearer here" relitigates `CON-1`; follow it or report `Blocked:`.
- **Silent waiver.** Copying a neighbour that breaks `CON-6` because "the sibling does it".
- **Renumbering.** Shifting ids breaks every plan and review that cited them.
- **Style trivia promoted.** Attribute order and import sorting belong to lint, not here.
