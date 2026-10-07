---
name: angular-nx-conventions
description: Use when placing, writing, planning or reviewing code in an Angular Nx workspace - a new library, screen, route, component, service, store, translation key or spec - before the code is written and again before the work is called done. Holds the rule ids agents cite and that a project can override.
---

# Angular Nx conventions

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

These are the defaults for an Nx workspace of one Angular app and per-domain libraries under `libs/<scope>/<name>`, each imported as `@org/<scope>/<name>`. Every rule has an id; plans, reviews and reports cite the id, not the prose.

## Overriding a rule

A project describes itself in `.claude/tether-nx.md`. Without the file, the defaults below apply. The keys:

| Key | Holds | Default |
|---|---|---|
| `alias` | The import prefix of the workspace's libraries | `@org/` |
| `ui` | The component library new screens use | Angular Material |
| `state` | The state approach for new code | signal services (`SIG-4`) |
| `i18n` | The translation library and the language files | the ngx-translate pipe; every file under `assets/i18n/` |
| `verify` | The one command that proves a task; `{base}` becomes the task's base commit | `npx nx affected -t lint test build --base={base}` |
| `paths` | `{ specs, plans, reports }` | `docs/specs`, `docs/plans`, `docs/reports` |
| `overrides` | `- <rule id>: <the project's rule>` lines; the line replaces that rule | none |
| `facts` | Lines every agent treats as true for this project | none |

```markdown
alias: @org/
ui: Angular Material
state: NgRx SignalStore in data-access libraries
verify: npm run verify -- --base {base}
overrides:
- CMP-1: The selector prefix is `acme-`.
- TS-1: `strictNullChecks` is off; write code that would pass it.
facts:
- The orders API returns amounts in minor units.
```

An override names one id. A rule the file does not name keeps its default. A rule that does not fit the project is overridden, never silently ignored.

## Rules

| Id | Rule | Guard |
|---|---|---|
| `NX-1` | Every library has `scope:<domain>` and `type:feature\|ui\|data-access\|util\|testing\|shell` tags; the app is `type:app` | `GUARD-2` reads the tags |
| `NX-2` | Layers point down: feature → ui, data-access, util; ui → ui, data-access, util; data-access → data-access, util; testing → testing, data-access, util, from specs only. Only feature and shell libraries are scope-private. No cycles | `GUARD-2` |
| `NX-3` | The app holds no code folder; a new domain is a new library | review |
| `NX-4` | A library is imported only through its alias, never through a path into `libs/…/src` (not even in a `jest.mock` string); imports inside a library are relative | `GUARD-2` |
| `NX-5` | A barrel exports only what another project imports; a feature library exports only its routes and `<domain>Providers` | review |
| `NX-6` | The shell library is sliced by screen like a feature | `GUARD-1` |
| `FEAT-1` | A feature library is sliced by screen: the routes file, then one folder per screen with the routed component flat at its root. Files two slices share sit flat at the library root. No technical or FSD folder at the top level | `GUARD-1` |
| `FEAT-2` | data-access keeps `store/ services/ models/ consts/ utils/`; ui and util are organised by kind; never restructured in passing | `GUARD-1` |
| `FEAT-3` | A feature never imports a feature; reuse goes through the other domain's data-access or ui library | `GUARD-2` |
| `DI-1` | A lazy domain has `<domain>.routes.ts` whose componentless root route carries `providers: <domain>Providers` | `GUARD-3` |
| `DI-2` | No `providedIn: 'root'` for a domain service. The exceptions are app-wide services, a service a dialog-opened component injects, and cross-scope API clients | review |
| `DI-3` | Standalone everywhere; no `NgModule` | review |
| `SIG-1` | `computed()` params → `resource({ params, loader })` → Promise-returning service methods; `linkedSignal` keeps the previous value | review |
| `SIG-2` | No `toObservable`, no Subject + switchMap, no Observable-returning service, no bare signal read or `subscribe` inside `effect()` | review |
| `SIG-3` | RxJS is for timers, DOM events and value-less event buses; `firstValueFrom` inside a service is fine | review |
| `SIG-4` | New state is a signal service; an existing store stays in its domain's data-access library | review |
| `CMP-1` | A new component is standalone and `OnPush`, has the project's selector prefix and uses the new control flow | review |
| `CMP-2` | Interfaces live in a sibling `*.model.ts`, never in a service or component file | review |
| `CMP-3` | No comments in TS, HTML or SCSS; other people's comments stay | review |
| `COPY-1` | Every user-visible string is a translation key, present in every language file | review |
| `TEST-1` | A co-located spec sits beside every changed behaviour; test-first is not required | review |
| `TS-1` | Code compiles under `strict`, `strictNullChecks` included | `tsc` |
| `GUARD-1` | A library-shape spec enforces `FEAT-1`/`FEAT-2` | — |
| `GUARD-2` | A boundary lint enforces `NX-2`/`NX-4` | — |
| `GUARD-3` | A provider-census spec enforces `DI-1` | — |

"review" means no automated check exists; the reviewer cites the id. What each guard fails on, and how to build one where the workspace lacks it: [references/guards.md](references/guards.md). The data-flow rules with a worked example: [references/signals.md](references/signals.md).

### Placement in practice

- A new screen in an existing domain is a slice folder in that domain's feature library (`libs/orders/feature/src/lib/order-details/`), its routed component flat at the slice root, its sub-components in sub-folders (`FEAT-1`).
- A service one screen uses sits flat in that slice; one two slices share sits flat at the library root; never a `services/` folder in a feature library (`FEAT-1`). In a data-access library it goes in `services/` (`FEAT-2`).
- What another domain renders is a ui library; what another domain injects or types against is a data-access library (`FEAT-3`). A routeless widget another domain renders is ui plus data-access, never a feature.
- A test generator lives in the scope's testing library and is imported from specs only. A data-access library's specs never import their own scope's testing library: the generator imports that library's models, so it is a cycle (`NX-2`).

## Where this skill departs from `angular-architecture` and the vendored skills

- `FEAT-3` forbids feature → feature outright; two features that need the same component share a ui library, and two that need the same data share a data-access library.
- Nx libraries replace `features/` folders: a domain is a set of libraries tagged by `NX-1`, not a folder tree inside the app (`NX-3`).
- No new resolver: a screen's record loads through a `resource`, see [references/signals.md](references/signals.md).
- References inside the vendored `ng-performance` and `ng-accessibility` to house rules (`AGENTS.md`, `style-guide/*`, `create-e2e-tests`, "this project", the workshop) mean the upstream project they came from, not this one. This skill and the project's rules file win where they differ. Notably, `CMP-1` sets `OnPush` explicitly; on an Angular version whose default is already `OnPush`, `CMP-1` means "never opt out of `OnPush`".
- Where this skill and `angular-architecture` disagree, this skill wins, and the rules file wins over both.

## Done when

1. Copy: every new user-visible string is a translation key in every language file the `i18n` key names; no hardcoded text left in a template (`COPY-1`).
2. Placement checked against `NX-1`…`NX-6`, `FEAT-1`…`FEAT-3` and `DI-1`…`DI-3`; every import goes through an alias and a barrel; no new deep import.
3. The rules file's `verify` command, run with the task's base commit, passes, and its output is pasted.
4. A spec sits beside every changed behaviour (`TEST-1`), and every state of a view union has a case.
5. The report ends with `Files:`, `Checks:`, `Deferred:` and `Plan edits:`, or with a single `Blocked:` line.

## Common mistakes

- A key in one language file only: that is a missing translation in the other, not a fallback (`COPY-1`).
- A `components/`, `services/` or `models/` folder at the top level of a feature library, or a data-access library restructured into `ui/ model/ api/` in passing (`FEAT-1`, `FEAT-2`).
- A relative path into another library, in an import or in a `jest.mock` string. Mock a library function through its alias: `jest.mock('@org/shared/util', () => ({ ...jest.requireActual('@org/shared/util'), fn: jest.fn() }))` (`NX-4`).
- A generator or fixture exported from a production library's barrel: it pulls test code into that library's production build; it belongs in the scope's testing library (`NX-5`).
- A data-access file importing a ui library or a component (`NX-2`).
- A static import of a lazily loaded feature library outside the app's route table (`FEAT-3`, `NX-5`).
- A domain service registered with `providedIn: 'root'` instead of in `<domain>Providers` (`DI-2`).
- Re-providing in a spec what the shared Jest setup already provides: the second copy shadows the real one.
- The library's environment read by importing the app's environment file; a library injects a token the app provides (`NX-2`).
- `toObservable`, a Subject + switchMap pipeline or an Observable-returning service in new code (`SIG-2`).
- A comment or JSDoc on new code (`CMP-3`), or an interface inside a service file (`CMP-2`).
- A lint rule silenced instead of the file fixed.
