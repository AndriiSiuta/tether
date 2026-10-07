---
name: investigating-codebase
description: Use when a change, feature, or bug must be understood before it is planned or specced and the touched files, data flow, or constraints are not yet known - before brainstorming a design, before writing-plans, or when a bug report names a symptom but not a location.
---

# Investigating Codebase

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

## Overview

An investigation is a one-page map of what a change touches, built only from files that were actually opened. It ends where design begins: files, flow, facts, questions. Never a proposed field name, formula, or snippet.

## When to Use

- "Before I plan X, what does it touch?"
- A bug report names a symptom, not a file
- A spec section is about to be amended and the code may have drifted

Not for: tasks whose files are already named; greenfield work with no code to read.

## The report is the output

Return exactly this, in this order. Every section appears; an empty one says `- none`. Caps: Files ≤12 rows, Flow ≤2 lines, Reuse ≤3, Constraints ≤5, Risks ≤3, Open questions ≤3. Role cells ≤8 words, bullets one line.

```
# Investigation: <change in ≤8 words> — <YYYY-MM-DD>
Ask: <one line>
Verdict: fits existing pattern | needs new domain | needs spec change   (label only, nothing after it)

## Files
| Layer | File | Role | Touch |
| docs | <spec / backlog / ADR that governs this> | <what it says, ≤8 words> | read |
(Touch = edit · read · new · if <option>. One row per file. Only files someone opened; else `unverified`. The docs row is required: if nothing governs the ask, write `| docs | none found | searched <dirs> | — |`.)

## Flow
<UI> → <client fn> → <METHOD /path> → <controller fn> → <service fn> → <storage> → <mapper> → <where it renders>

## Reuse (exists, do not reinvent)
- <helper> in <file> — <what it does>

## Constraints
- Product rules that apply (copy, caps, per-user scoping): <rule> — <CLAUDE.md / spec section>
- <code invariant> — <file>

## Risks
- <what could break or drift> — <file>

## Open questions (≤3)
- <one sentence a human must decide. No lean, no example answer, no "likely".>
```

## Steps

0. Read `CLAUDE.md` and `ARCHITECTURE.md` if present. No map → add a layout sweep and note "no map" under Risks.
1. Anchors: 2–4 grep terms from the ask (type names, route paths, copy strings). One grep pass shows which layers the change crosses.
2. Sweep each layer (max 3) and always the docs and history sweep (spec, backlog or follow-ups, ADRs, `git log -S<anchor>`). Bugs included: a backlog often already names the bug. With the Agent tool: one Explore subagent per sweep, in parallel, cheapest model, prompts in `references/dispatch-prompts.md`. Without it: the same sweeps yourself, same questions.
3. Merge. Every Files row cites a file that you or a subagent opened.
4. Fill the template. Cut to budget: a row beats a paragraph, a bullet beats a row.
5. Stop. Hand the report back. Design is the next step.

## Quick Reference

| Situation | Do |
|---|---|
| A design choice changes which files are in scope | Rows for both sets with `Touch = if A` / `if B`; the choice is an Open question |
| A helper already does part of the job | Reuse row. Not "we could extend" |
| A field, schema or formula wants a name | Files row for the file that will hold it. The name belongs in the spec |
| A type crosses a layer boundary (DTO, read model, shared type) | Its own Files row, even if the ask never mentions it |
| The server computes a value | Grep the client for the same expression; optimistic stores often recompute it |
| A backlog or follow-ups doc exists | Open it; overlapping items go under Constraints or Risks |

## Red flags — you are designing, not investigating

- You typed a new identifier (`recurringAmount`) or an expression (`left = amount - spent - fixed`)
- "Most likely…", "the first fits…", "simplest would be…" anywhere
- One heading per file with a paragraph under it
- A verdict followed by a justification clause
- The report ends with "want me to implement this?"

Caught one: delete it, write the Files row or the Open question instead.

## Common Mistakes

- **Boundary type missed.** Schema and component opened, the shared read-model type between them not. Every sweep answers "type in / type out".
- **Client copy of server math missed.** The API computes `left`; the web store recomputes it on optimistic update. Both rows.
- **Backlog skipped.** A follow-ups list often names part of the work or forbids it.
- **Product rules left implicit.** Copy rules, caps, per-user filters live in `CLAUDE.md` or the spec; the first Constraints bullet cites them.
- **Over the caps.** Right facts, 900 words, Role cells with code in them. Nobody reads page two.
- **Docs sweep skipped for a bug.** The root cause was found in code while the backlog already listed the bug and the agreed fix.

## Example

`references/example-report.md` — a filled report for a recurring fixed fee on project invoices.
