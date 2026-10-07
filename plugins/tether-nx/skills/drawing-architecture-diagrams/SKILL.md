---
name: drawing-architecture-diagrams
description: Use when a spec, ADR, ARCHITECTURE.md, README or review needs a diagram - a context or container view, a request or data flow, a sequence, or an entity-relationship view of the storage - or when someone asks to visualise how parts of a system talk to each other.
---

# Drawing Architecture Diagrams

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

## Overview

A diagram in a repo is read in a code review, at 80 columns, by someone who did not draw it. It earns its place only when it shows a mechanism the prose cannot: who calls whom, in what order, keyed by what. Three shapes cover that; everything else is a table.

## When to Use

- A doc needs to show boundaries (context/container), an order of calls (sequence), or storage keys and relations (ERD)
- A review found a flow nobody could explain in words

Not for: class diagrams, mind maps, pie charts, org charts, UI mockups (use a screenshot), or a list of files (use a table).

## Three shapes, fixed caps

| Shape | Mermaid | Cap | Shows |
|---|---|---|---|
| Context / container | `flowchart LR` | ≤12 nodes, ≤2 subgraphs | Systems and processes; one edge per transport, labelled with the real mechanism |
| Request flow | `sequenceDiagram` | ≤8 participants, ≤14 messages, ≤2 notes | One path, happy case; a second path is a second diagram |
| Storage | `erDiagram` | one entity per collection or table; keys, indexed fields, foreign keys only | Ownership and joins; embedded sub-documents are a field, not an entity |

Over a cap: cut lifelines that only forward, merge nodes that always appear together, drop fields that are neither keys nor indexed. A diagram that needs more than the cap is two diagrams.

## Source of truth

Every label states something verified in a file you opened: the header or cookie name, the route, the collection, the index. Name the file under the diagram in the caption. An auth mechanism, a transport, or a queue you did not open is `unverified` in the caption, not a guess in the box.

## Where the diagram lives

- Inline Mermaid fence in the markdown doc, so it diffs in git and renders on GitHub. Default.
- FigJam via `figma:figma-generate-diagram`, if installed, only when the reader wants to present or edit it; load that skill first (it is mandatory before the tool), and still paste the same Mermaid source into the doc.
- Artifacts / SVG: the `artifact-diagramming` skill, if installed, not this one.

## Mermaid rules (shared with the FigJam skill)

- Node ids camelCase, no spaces; not `end`, `graph`, `subgraph`.
- Labels with `(`, `:`, `/`, `|` or quotes go in `["..."]`; edge labels in `-->|"..."|`.
- Line breaks inside a label are `<br/>`; `\n` renders literally.
- Sequence participants get short aliases: `participant api as OrdersApi`.
- No styling, colours or icons; the doc's theme does that.

## Steps

1. Pick the one shape that answers the reader's question. Two questions → two diagrams.
2. Open the files that define each box and each edge (routes, schemas, interceptors). Write the caption's file list first.
3. Draw within the cap using `references/templates.md`.
4. Caption: one sentence on what the diagram shows, then `Files: …`.
5. Check the fence renders: no `\n`, quoted special characters, cap respected.

## Common Mistakes

- **Every lifeline that exists.** Store, api client, interceptor, controller, service, mapper, renderer: the reader wants the four that decide something.
- **ERD as a schema dump.** Nullable, legacy and display fields hide the keys. Embedded arrays drawn as entities invent a collection that does not exist.
- **Transport from memory.** "JWT bearer" when the code sets an httpOnly cookie. Open the guard.
- **`\n` in labels.** Renders as text on GitHub.
- **Notes as prose.** More than two notes means the caption should say it.
