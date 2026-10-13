---
name: syncing-docs
description: Use when a branch or task is finished and the docs may have fallen behind the code - before opening a PR, after a hotfix, when deferred items and open questions need recording, or when someone asks whether a spec, an ADR, a rules file or the follow-ups register is still current.
---

# Syncing docs

Read `.claude/tether-web.md` first; where it differs from this file, it wins.

## Overview

Docs drift one commit at a time, so the check is driven by the diff, not by rereading every doc. Each kind of change has exactly one home; the job is to walk the diff, find the rows that are missing or stale, and write them there. A fact that appears in two docs is fixed in its home and the copy becomes a pointer, never a second edit.

Paths come from the rules file's `paths` (`.claude/tether-web.md`, falling back to `.claude/tether-nx.md`): `specs` (default `docs/specs`), `plans` (`docs/plans`), `reports` (`docs/reports`), `followUps` (`docs/follow-ups.md`).

## When to Use

- A branch is finished, or about to become a PR
- A hotfix changed behaviour a spec describes
- Implementers reported `Deferred:` items or open questions that nobody has written down

Not for: writing a new spec (`tether-web:writing-feature-spec`) or a decision record (`tether-web:writing-adr`); those are targets this skill points at.

## The mapping

| The branch | Home that must change |
|---|---|
| Changed a feature's behaviour, copy or acceptance criteria | That feature's spec under `paths.specs`: a dated entry under `## Amendments` giving the replacement row |
| Left a plan task undone, or did it differently | A follow-up in `paths.followUps`; the plan under `paths.plans` is history and is never rewritten |
| Made a rule that spans features, or reversed one | A new ADR via `tether-web:writing-adr`, plus a one-line pointer from the rule it backs |
| Contradicts an accepted ADR | Report it and ask; a superseding ADR is written only on the user's ruling |
| Changed a path, a command, a port, a token prefix, a reviewer list, the `verify` command | The key that holds it in `.claude/tether-web.md` or `.claude/tether-nx.md` (`facts`, `paths`, `verify`, `overrides`) |
| Changed or waived a non-negotiable | The constitution file (`constitution` key, default `.claude/constitution.md`), only on the user's ruling (`tether-web:constitution`) |
| Deferred a check, left a `TODO`, an open question, a review finding not fixed | A new entry in `paths.followUps` |
| Resolved an open follow-up | Its entry in `paths.followUps`, marked done with the branch |

Docs no row points at are not opened. Research notes and run reports under `paths.reports` are history, like plans.

## The follow-ups register

One file, `paths.followUps`, appended under a dated heading per branch; an earlier heading is never rewritten except to mark an item done.

```markdown
## 2026-10-13 · feature/order-export-csv

| Area | Follow-up | Source | Status |
|---|---|---|---|
| orders/feature-export | Cancelled lines are left out of the CSV; product to decide whether they belong | spec Open decisions D4 | open |
| invoices/data-access | The PDF endpoint returns no due date; backend contract to add it | implementer Task 3 `Deferred:` | open |
| orders/ui | Manual check of the export button below `xl` | plan Task 5 | done in feature/order-export-csv |
```

Area is the library or folder the item lives in, so the investigator can find open items for the area it is about to touch.

## Steps

1. Run this skill's `scripts/branch-diff.sh <base>`, `<base>` the default branch; it prints the paths touched since the merge base. Sort them by the left column of the mapping; `git log --oneline <base>..HEAD` gives the commits behind them.
2. Collect the branch's `Deferred:`, `Plan edits:` and unfixed review findings from the reports under `paths.reports` and the dispatch notes.
3. Read `paths.followUps` for open items in the touched areas; mark the resolved ones done.
4. For each mapping row that applies, open the home and check the fact against the code. Fix a stale sentence where it lives; replace any copy of it elsewhere with a pointer.
5. Output the edit table, then apply the edits.
6. Commit or not as the project decides (`facts` says whether `docs/` is committed). A committed docs edit is its own commit after the code commits, never folded into one; a local-only doc is never staged.

## Output

```
## Docs sync: <branch or range>
| Doc | Section | Edit |
|---|---|---|
| docs/specs/2026-10-01-order-export-csv.md | Amendments | 2026-10-13: the file name carries the period, `orders-2026-01.csv` |
| docs/follow-ups.md | 2026-10-13 · feature/order-export-csv | 2 open, 1 done |
| .claude/tether-web.md | facts | preview runs on port 4300 |
Checked, current: <homes the mapping pointed at that needed nothing>
Not checked: <docs no row pointed at>
Report only: <ADR contradictions, docs the project marks as not to be edited>
```

One row per edit, one line per row; no narrative of how the drift happened.

## Common Mistakes

- **Auditing every doc.** Reading every spec costs an hour and finds the rows the diff would have.
- **Describing drift instead of fixing it.** The output is the edits, applied.
- **Two homes.** The same sentence corrected in the spec, the rules file and an agent body; fix the home, point from the rest.
- **Rewriting a plan or an old register heading.** Both are history; append.
- **A follow-up without an area.** The next investigator cannot find it.
- **"Checked, current" without the file opened** against the code.
- **A docs edit inside the code commit.**
