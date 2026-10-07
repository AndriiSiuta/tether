---
name: writing-feature-spec
description: Use when a brainstorm has converged and a ticket or request needs its design written down before planning, or when an existing spec must be amended for a change - after the approach is agreed, before the plan is written.
---

# Writing a feature spec

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

## Overview

A spec records decisions so a plan can be written from it without asking again. It answers what changes for the user, what copy appears, what data the screen needs and where the code goes; it does not say how the code is written. Code belongs to the plan and the diff.

## When to Use

- The request or ticket has been read and the brainstorm ended with an agreed approach
- An existing spec no longer matches what is being built

Not for: exploring options (brainstorming), sequencing work (the plan), recording a cross-cutting rule (`writing-adr`).

## The document is the output

`<paths.specs>/YYYY-MM-DD-[<ticket>-]<slug>.md`, where `paths.specs` comes from the rules file (default `docs/specs`), for example `docs/specs/YYYY-MM-DD-order-export-csv.md`. The ticket number is optional. Sections in the order given by `references/spec-template.md`: Why · Ticket and acceptance criteria · Screens and design links · Copy · Data and API contract · Placement · Tests · Out of scope · Follow-ups · Open decisions · Diagram (optional). Every section appears; an empty one says "none".

Whether the file is committed is the project's choice, stated in the rules file's `facts:`; without one, leave it uncommitted.

Caps: 1,500 words in total, tables and type blocks included; tether's spec-cap hook enforces it when the project configures it. A large batch of components is split into several specs, each component pointing at its design link and its reference implementation instead of restating them. A refactor, a migration or a component wave uses `references/refactor-spec-template.md` instead of the feature template. Copy strings quoted exactly as they will render.

## Rules

- **Decisions only.** A choice the brainstorm did not make goes under `## Open decisions` as a question, never chosen silently in the prose.
- **No code.** No diffs, no function bodies, no template HTML. A field list is a table, not a TypeScript block with logic in it.
- **Write the copy strings first.** The table has a key column plus one column per language in the rules file's `i18n` (for example `en`, `de`); it forces the decisions, and a feature with an empty language column is not specced (`COPY-1`). Keys follow the project's translation-key convention.
- **Amend by appending.** When a change alters an earlier spec, say "amends `<path>` §n" in the new spec's header and add a dated entry under `## Amendments` at the end of the earlier file giving the replacement row; the earlier body is never rewritten, and there is no second spec about the same screen.
- **Name the backend contract.** Say which endpoint already serves the data and which fields the client model keeps, or say plainly that the backend must add it and the work is blocked.
- **Placement is a decision.** Name the library, the slice, where state lives, the provider scope and the feature flag that gates the feature, if any, by rule id where one exists.
- **More than three open decisions means the brainstorm is not finished.** Go back rather than writing them all down.

## Steps

1. Reread the request or ticket text the user provided — description, acceptance criteria, comments — and the brief; design facts come from the investigator's report in the brief, never from a fresh design read here.
2. Fill the template top to bottom; write the Copy table first.
3. Move anything that reads like implementation into the plan you will write next, or delete it.
4. List the open decisions and put them to the user before planning.
5. Write the file.

## Common Mistakes

- **Plan in spec clothing.** Diffs, service method signatures, markup. A reader should not learn file names beyond the folders the template names.
- **Copy described, not written.** "shows the customer name" instead of the string in quotes, with its key.
- **One language only.** A language column left blank because "translation comes later" — it does not; every language file changes in the same commit.
- **Silent design.** A new column, a new empty state, a new error message appearing without being asked for.
- **Acceptance criteria paraphrased.** Paste them from the ticket text the user provided; the Tests section maps one spec to each.
- **Edge cases as a section.** Each is a rule in its own section, an out-of-scope bullet, or an open decision.
