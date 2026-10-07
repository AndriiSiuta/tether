---
name: typescript-style
description: Use when writing or reviewing TypeScript in an Angular or Nx workspace — a component that loads a list, a value that may be absent, a sort or search over rows, a column config, a class toggle in a template, a helper that already exists once elsewhere — before the code is written and again at review. Also when a static-analysis finding or a strictNullChecks error lands on a file.
---

# TypeScript style

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

## Overview

State is a type, not a sentinel. A piece of code says what it holds: a discriminated union for a screen state, a narrow return type for a value that may be absent, a pure function for anything that reads rows. Code compiles under `strict`, `strictNullChecks` included (`TS-1`); where the workspace compiler is looser, write as if it were on, and the rules file's `verify` command proves it for the folders you touched.

## The recipe

| Situation | Write | Source |
|---|---|---|
| A list loaded by `resource()` | One `computed<TableView<Row>>` built by `deriveTableView({ rows: keptRows(), hasFailed: status() === 'error', matches })` (`loading \| ready \| empty \| error`) — a pure helper in the workspace's `util` library, written once with a spec; the held rows are read before the error check (signals are lazy); the template does `@let state = view();` and `@switch (state.kind)`. `value()` is read only behind `hasValue()`. `ready.rows` is the array the table component owns and may sort in place. | angular.dev resource guide; `references/before-after.md` §1 |
| Keep rows while the params change | `linkedSignal({ source: () => (r.hasValue() ? r.value() : undefined), computation: (v, prev) => v ?? prev?.value })`; a plain `reload()` keeps its value on its own. | angular.dev linkedSignal guide |
| A value that may be absent | The type says so at the edge (`number \| undefined` on the return, an optional field on the model); nothing in the middle uses `undefined` to mean "not yet". A nullish check, when the type cannot rule it out, is the project's typed nullish helper, never `== null`/`!= null`; `=== null`/`=== undefined` only when the type is exactly that one; `0` and `''` are handled on their own. | TS handbook narrowing; Effective TypeScript items 32, 33 |
| A column config | `defineTableColumns<Definition>()([...])` — a pure helper in the workspace's `util` library, written once with a spec (a `const` type parameter keeps the literal ids while every element carries the definition's optional keys); the id union is `(typeof COLUMNS)[number]['id']`; cell values come from a typed `Record<ColumnId, (row: Row) => CellValue>` and `createCellText(columns, values)`, the same kind of helper, gives `isColumnId` and `cellText`; every column that renders a row value has an accessor returning it, `() => undefined` only for button/action columns. | TS 5.0 `const` type parameters; Effective TypeScript item 9 |
| Sort and search | Pure functions in the `util` library's table utilities, written once with a spec: one comparator (nullish last in both directions, numbers numeric, strings numeric collation), one `cellText`; search is `columns.some(c => cellText(row, c).includes(term))`. Own the array: `toSorted`; a table component's custom-sort callback that sorts in place is the one exception. | MDN `toSorted`; `lib: ["ES2023"]` |
| A helper that already exists once | Lift it on the second copy into the workspace's `util` library beside its kin, exported through its barrel, with a spec. | the deletion test: a helper whose removal would duplicate code is earning its place |
| A class toggle | `[class.order-row--priority]="hasPriority()"`; no `Record<string, boolean>` method on `[ngClass]`; a template calls no method that a `computed` can replace. | angular.dev class binding guide |
| Fields and arrays | `readonly` fields; `readonly T[]` for arrays handed around; no `!`; an unavoidable `as` lives inside one typed wrapper function. | Google TS style guide |
| A union in a `switch` | Exhaustive, with a `never` default; `@typescript-eslint/switch-exhaustiveness-check` is on. | TS handbook exhaustiveness |
| Parameters | Never reassigned; defaults with `??`. | `no-param-reassign` |
| A boolean from a service | Named for what it holds; `checkPermission()` returns `true` when restricted, so the field is `isRestricted`, never `canAccess = !checkPermission(...)`. | naming |

## Before you report a task done

- The rules file's `verify` command passes, and the folders you touched compile under `strictNullChecks` (`TS-1`).
- No occurrence of `prefer-readonly`, `prefer-optional-chain`, `prefer-includes`, `switch-exhaustiveness-check`, `no-non-null-assertion`, `no-unneeded-ternary`, `no-param-reassign` in a file you touched.
- Every state kind of a view union has a spec case.

## Common mistakes

- `initialized = computed(() => rows() !== undefined)`: a boolean that forgets the error state. Use the union.
- A third signal (`rows = computed(() => loaded() ?? [])`) to erase the sentinel the first signal introduced.
- `getSortValue(row, field: string): string | number | undefined` and a `values.join('').includes(term)` haystack: a stringly path and a match across cell boundaries.
- `unit = unit || 'kg'` on a parameter: reassignment, and a `0` weight loses its unit.
- Copying a neighbour file without reading it against this table.
