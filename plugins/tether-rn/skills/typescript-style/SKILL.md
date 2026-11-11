---
name: typescript-style
description: Use when writing or reviewing TypeScript in a React Native app — a screen that loads a list, a value that may be absent, a sort or search over rows, route params, a style that depends on state, a helper that already exists once elsewhere — before the code is written and again at review. Also when a static-analysis finding or a strict-mode error lands on a file.
---

# TypeScript style

Read `.claude/tether-rn.md` first; where it differs from this file, it wins.

## Overview

State is a type, not a sentinel. A piece of code says what it holds: a discriminated union for a screen state, a narrow return type for a value that may be absent, a pure function for anything that reads rows. Code compiles under `strict` (`TS-1`); where the app's compiler is looser, write as if it were on, and the rules file's `verify` command (default in `react-native-conventions`) proves it for the files you touched.

## The recipe

| Situation | Write |
|---|---|
| A screen that loads data | One value of a union `{ kind: 'loading' } \| { kind: 'ready'; rows } \| { kind: 'empty' } \| { kind: 'error'; message }`, derived by a selector or returned by the query hook; the screen does one `switch (view.kind)`. Never three booleans (`isLoading`, `hasError`, `isEmpty`) that can disagree. |
| A value that may be absent | The type says so at the edge (`number \| undefined` on the return, an optional field on the model); nothing in the middle uses `undefined` to mean "not yet". Read with `?.`, default with `??`; `0` and `''` are handled on their own, never swept up by `\|\|`. |
| Route params | Typed by the navigator's param list (`NAV-4`); a param that may be missing is optional in the type and defaulted where it is read, never asserted with `!`. |
| Data from the network | Typed at the api function's return as the feature's model, mapped from the DTO there; no `any` and no DTO shape past `api.ts`. |
| Sort and search | Pure functions with a test: one comparator (absent values last in both directions, numbers numeric), one text accessor per column; own the array with `toSorted` or a copy, never sort a prop or a store value in place. |
| A helper that already exists once | Lift it on the second copy into `shared/utils` beside its kin, with a test. |
| A style that depends on state | An array of static styles and a condition: `[styles.row, isSelected && styles.rowSelected]`. An inline object only for a value computed at render (`CMP-2`). |
| Props and arrays | A `Props` type per component (`CMP-1`); `readonly T[]` for arrays handed around; no `!`; an unavoidable `as` lives inside one typed wrapper function. |
| A union in a `switch` | Exhaustive, with a `never` default. |
| Parameters | Never reassigned; defaults with `??`. |
| A boolean | Named for what it holds and read without negation: `isArchived = order.status === 'archived'`, never `notActive = !isActive(order)`. |
| A hook's dependencies | Complete. A value left out to stop a re-run is a bug with a lint rule silenced; restructure so the dependency is stable. |

## Before you report a task done

- The rules file's `verify` command passes, and the files you touched compile under `strict` (`TS-1`).
- No new `any`, `as any`, `// @ts-ignore`, `!` or `eslint-disable` in a file you touched.
- Every state kind of a view union has a test case.

## Common mistakes

- `const isReady = rows !== undefined`: a boolean that forgets the error state. Use the union.
- `unit = unit || 'kg'` on a parameter: reassignment, and a `0` weight loses its unit.
- A response typed `any` at the api function and "typed" by an `as` in the screen.
- `navigation: any` or `route.params!.id` to get past a missing param type (`NAV-4`).
- An inline `style={{ … }}` object of static values recreated on every render (`CMP-2`).
- Copying a neighbour file without reading it against this table.
