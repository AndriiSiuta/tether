---
name: run-report
description: Use when a planned run (spec, plan, implementer and reviewer dispatches) has finished, or is stopping, and its run report must be written in the project's reports folder - before the click-through, before a PR is opened.
---

# Run report

One report per run, written by the dispatcher, at `<reports>/<YYYY-MM-DD>-<slug>-run-report.md` (`reports` in `.claude/harness.json`). It records what shipped, every ruling made on the way, and the token ledger. If your project's verify step enforces it, a branch with an open PR is refused until a report names that branch and carries a sign-off row.

## Template

Copy this skeleton and fill every section; write `none` in a section that has nothing.

````markdown
# <Run title> — run report (<YYYY-MM-DD>)

Branch: `<branch>`
Sessions: <session id>, <session id>
Agent ids: 1=<agent id>, 2=<agent id>

<One paragraph: the base commit, the spec, the plan, the origin of the work.>

## Outcome

<Commits and the tip SHA, what changed in numbers, the verification run on the tip and its result lines.>

## Rulings (in order; what each costs if wrong)

- R1: <the ruling, who made it, and the cost if it is wrong>.

## Departures from the spec

- <What differs from the spec and why.>

## Deferred: click-through

- <Each manual check, one per line: the union of the implementers' `Deferred:` items.>

## Follow-ups

- <Work left for a later branch or ticket.>

## Token ledger

| # | Agent | Model | Task | Tokens | Tool uses | Wall time | Findings changed code | Findings refuted | Tool failures | Hook blocks |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | <agent type> | <model> | <task> | <tokens> | <tool uses> | <s> | – | – | 0 | 0 |

## Sign-off

| SHA | Date | Verified by | Checklist |
|---|---|---|---|
````

## Rules

1. `Branch:` names the branch exactly as `git branch --show-current` prints it, in backticks. `Sessions:` lists the session ids, comma-separated; `Agent ids:` maps each ledger row number to its agent id as `<#>=<id>`. The ledger filler reads these two lines.
2. The ledger has one row per dispatched agent, numbered from 1 in dispatch order. Reviewer rows fill `Findings changed code` and `Findings refuted`; other rows write `–`. `Tool failures` and `Hook blocks` come from telemetry when it is on.
3. Rulings are numbered in the order they were made, each with its cost if wrong.
4. The click-through list is the union of every implementer's `Deferred:` items, without duplicates.
5. The sign-off table stays empty until the person who verifies the run has done the click-through. Then add one row: the tip SHA that was verified (7 to 40 hex characters), the date, the name, and the checklist items that were checked. A later fix adds a new row for its new tip.
6. The fix-round cap is checked when an implementer stops after a round, and its message names the rounds used. It counts an implementer's stops per session and task, so a new session starts every task at zero. To reset a cap after an escalation within the same session, delete that task's file under `${CLAUDE_PLUGIN_DATA}/rounds/` (named by the SHA-1 of `<session_id>|Task <id>`) and record the reset as a ruling.
