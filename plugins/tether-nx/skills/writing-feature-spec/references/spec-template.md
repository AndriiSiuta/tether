# [<ticket>] <Feature title>

Date: YYYY-MM-DD · Status: draft | agreed · Amends: `<paths.specs>/<file>.md` §<n> (or "none")

## Why

Two or three sentences: the need in the user's or the ticket's words, what the app does today, what changes for the user. No solution here.

## Ticket and acceptance criteria

Optional ticket fields: the ticket id, its state and its board, when there is a ticket. Then the acceptance criteria pasted from the ticket text the user provided, one bullet each, unedited. Note anything the ticket asks for that this spec deliberately does not do, and why.

## Screens and design links

One bullet per screen that changes, with the route it lives on and what appears or disappears. Design links (read, not guessed) with the frame name beside each. A new screen gets its route line: the path, the guards it sits behind, and whether it is in the navigation.

## Copy

Written first. Every user-visible string, with its key per the project's translation-key convention, and one column per language in the rules file's `i18n`. Every column is filled here, not later (`COPY-1`).

| Key | en | de |
|---|---|---|
| `orders.edit.saveButton` | "Save" | "Speichern" |

Also list any string being removed, so the dead keys can be deleted from every language file.

## Data and API contract

The fields the screen needs, as a table, and where they come from.

| Field | Type | Source |
|---|---|---|
| `orderId` | number | route param |
| `totalAmount` | number, currency minor units | `GET /orders/{id}` (already served) |

State plainly: served today / must be added by the backend (with its ticket, if any) / derived on the client. A field the backend does not serve yet is a blocker, not a detail.

## Placement

Each by rule id: the library and its `type:` (`NX-1`, `NX-3`); the slice the work lands in (`FEAT-1`); where state lives — an existing store, a signal service or component state (`SIG-4`); the provider scope (`DI-1`, `DI-2`); the feature flag that gates it, if any, and its key. Anything new in a shared library needs a reason and the library whose `type:` fits.

## Tests

One line per acceptance criterion naming the spec file that will prove it (`TEST-1`). Pure functions get their own spec; a container spec covers the wiring. Say which existing specs change because a dependency was added.

## Out of scope

Bullets. Things a reader might expect this feature to do and it does not.

## Follow-ups

Bullets for work this deliberately leaves behind, or "none".

## Open decisions

Numbered questions, each with the options and the trade-off, unanswered. More than three means the brainstorm is not finished. "none" when there are none.

## Diagram (optional, at most one)

A Mermaid `sequenceDiagram` or `erDiagram` per the `drawing-architecture-diagrams` skill, only when the flow is not obvious from the tables.
