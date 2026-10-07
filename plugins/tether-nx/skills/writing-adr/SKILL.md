---
name: writing-adr
description: Use when a decision spans more than one feature or reverses an earlier choice - a library adopted or refused, a verification or testing policy, a storage or auth model, an API documentation approach - and someone asks to record, document, or justify it. Not for per-feature choices, which belong in the feature's spec or the follow-ups list.
---

# Writing an ADR

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

## Overview

An architecture decision record is the shortest document that lets a future reader stop re-litigating. It states what was decided, why then, and what it costs. 200 words is the cap because a longer record gets skimmed and the decision gets re-litigated anyway.

## When to Use

- The choice constrains several features (no tests, no swagger, types-first, cookie auth, one process serves both apps)
- A spec choice is being reversed and the old reason should survive
- A reviewer keeps asking "why don't we just…"

Not for: a single feature's design (spec), a small "fine as is" verdict (follow-ups list), a task-level trade-off (plan).

## The record

Path: `docs/<decisions dir>/NNNN-<slug>.md`, `NNNN` zero-padded and sequential; in this repo `docs/adr/`. One decision per file. Never edit a decision's text after it is accepted; supersede it with a new record and set the old status.

```
# NNNN: <decision in ≤8 words>

Status: accepted YYYY-MM-DD | superseded by NNNN | proposed
Applies to: <spec §, CLAUDE.md rule, skill> — the places that must point back here

## Context
<2–4 sentences: the situation and the forces, in the past tense.>

## Decision
<1–3 sentences, present tense, imperative where possible. What is done and what is not done.>

## Consequences
- <cost or risk accepted, with the mitigation if any>
- <what becomes easier>
- <what would trigger revisiting>
```

Caps: 200 words below the title. Three consequences at most. No history of the conversation, no alternatives section unless one was actually tried.

## Steps

1. Check the decisions directory for an existing record on the same subject; if one exists, write a superseding record instead of editing it.
2. Find every place that states the rule today (spec section, `CLAUDE.md`, a skill) and list them under *Applies to*.
3. Write the record within the caps.
4. Add a one-line link to the record from the spec section or rule it backs (`Decision: see docs/adr/NNNN-….md`).

## Common Mistakes

- **Narrative context.** Who asked, in which session, how the plan evolved. The reader needs the forces, not the story.
- **Decision that restates the rule from CLAUDE.md verbatim.** Say what is excluded too: "no test runner, no spec files, no test dependencies".
- **Consequences that are only benefits.** The first consequence is the cost.
- **Orphan record.** Nothing links to it, so nobody finds it before re-litigating.
