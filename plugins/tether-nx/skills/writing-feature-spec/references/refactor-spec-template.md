# <Title>

Date: YYYY-MM-DD · Status: draft | agreed · Amends: `<paths.specs>/<file>.md` §<n> (or "none")

Cap: 1,500 words in total, tables included. A large batch of components is split into several specs.

## Goal

Two or three sentences: what is wrong or missing today, and what is true when this is done. No solution here.

## Inventory

One row per unit the work touches: a library, a component, a file family. The table is the scope; a unit not in it is out of scope. For a component, point at its design link and its reference implementation instead of restating them.

| Unit | Today | After | Source |
|---|---|---|---|
| `libs/<scope>/<name>` | | | |

## Rules the result must satisfy

Numbered, each checkable by reading the code or running a command. Point at the owner of a rule (a rule id, an ADR, a design link, a lint rule) rather than restating it.

## Guard

Per rule above, the check that fails if it is violated: `GUARD-1` (the library-shape spec), `GUARD-2` (the boundary lint), `GUARD-3` (the provider-census spec), or a new guard this work adds; or "none" written plainly.

## Verification

The commands and their expected result, starting with the rules file's `verify`. Manual checks as one click-through list, one line per check with the expected result.

## Out of scope

Bullets. Things a reader might expect this work to do and it does not.

## Follow-ups

Bullets, or "none".

## Open decisions

Numbered questions, each with the options and the trade-off, unanswered. More than three means the brainstorm is not finished. "none" when there are none.

## Amendments

Dated entries added by later specs, newest last, never edits to the body above: `YYYY-MM-DD, by <spec path>: §<n> <replacement>`.
