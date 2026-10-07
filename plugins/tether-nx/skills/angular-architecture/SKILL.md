---
name: angular-architecture
description: Use when deciding where an Angular file belongs or whether one part may import another - adding a feature or domain, splitting a screen into components, choosing root vs route-level vs component providers, placing shared kit vs feature UI, deciding which layer fetches data and which owns state, or untangling a cross-feature or circular import. Structural placement and dependency direction for Angular 17+ signal-era apps; for per-file API rules (signal syntax, control flow, OnPush) use angular-best-practices.
---

# Angular Architecture

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

## Overview

This skill answers two questions only: **where does this file go**, and **may this file import that one**. Per-file syntax belongs to `angular-best-practices`; store library idioms belong to `angular-best-practices-signalstore`.

Two invariants generate every rule below:

1. **Dependencies point one way:** `app shell → feature → shared → core primitives`. Nothing in `shared/` knows a feature exists.
2. **A file's right to inject is set by its layer, not by how many places use it.** "Three screens use it" makes something shared; it does not make it dumb, and it never licenses moving an injecting component into the shared kit.

Long material: `references/layer-boundaries.md` (full may-inject matrix, cross-feature widgets, store-to-store fixes), `references/di-scope.md` (route-provider recipes and teardown).

## Feature slicing

One folder per domain. The folder is the unit of ownership, lazy loading, and deletion — if removing a feature means editing five unrelated folders, the slice is wrong.

```
src/app/
  core/                      app-wide singletons: interceptors, auth, theme, config
  shared/ui/                 domain-agnostic presentational kit
  features/
    orders/
      orders.routes.ts       the feature's lazy entry point
      data/orders.api.ts     transport
      data/orders.store.ts   state
      pages/order-list.page.ts   orchestration (routed)
      ui/order-row.component.ts  feature-private presentation
      index.ts               public entry: routes + widgets other features may render
```

- **Everything under a feature is private except what `index.ts` exports.** Another feature imports `features/orders`, never `features/orders/data/orders.store`.
- A feature may depend on `shared/` and `core/`. Feature→feature is allowed only through the public entry point, and only downhill: if A and B import each other, the shared piece belongs in `shared/` (if presentational) or its own feature (if it has state). A project may forbid feature→feature outright and route every reuse through the other feature's data layer; then its own boundary check is the rule, and it is stricter than this one.
- `core/` holds what the app boots with. A store that only two screens use is not core.

## Layers and the talk rule

| Layer             | Owns                                                        | May inject                                                                | Must not inject                                         |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| **api client**    | transport, DTO↔model mapping                                | `HttpClient`, config tokens                                               | any store, any component, another feature's api         |
| **store**         | domain state + writes                                       | its own api client                                                        | another feature's store, `HttpClient`, `ActivatedRoute` |
| **page** (routed) | orchestration: what loads, what opens, what the route means | its feature's stores, router, dialog/toast, other features' public stores | `HttpClient`                                            |
| **feature ui**    | presentation of one domain's shapes                         | nothing (leaf), or its own feature's store (container)                    | any api client, another feature's store                 |
| **shared ui**     | domain-agnostic presentation                                | framework primitives only (`DestroyRef`, id/a11y helpers)                 | any api client, any store, anything from `features/`    |

Three rules do the real work:

- **Only the store calls the api client.** A component that injects an api client has moved transport into the view; the next screen that needs the same data refetches it and the two disagree.
- **A store injects its own api client and nothing else from the data layer.** If a fetch depends on a value another store owns, the value is an **argument**: `reports.load(range)`, with the page reading `range` and passing it. `ReportsStore` reaching into `DateRangeStore` hides the dependency, makes the store unusable on any screen without that picker, and takes the decision away from the layer that should make it.
- **Presentational components emit intent; they do not perform writes.** A leaf row that injects the store and calls `store.toggle()` looks convenient and costs you the ability to render that row anywhere else. Inputs down, outputs up, the container calls the store.

**A container is the component a screen hands a whole region to** — at most one per region, and the thing you would mount on its own to render that region. **If it takes one record as `input()` and appears inside a `@for`, it is a leaf**, whatever it is called. "This row owns its own writes, like the card next door" is the rationalization that dissolves the boundary one component at a time.

## Routing and DI placement

**One lazy route per feature**, via `loadChildren` pointing at the feature's `routes.ts` (or `loadComponent` for a single-screen feature). The feature's route file, not the app's, knows the feature's child paths.

Choose the provider scope by **lifetime and blast radius**, not by habit:

| Scope                 | Use for                                                                               | Cost                                                              |
| --------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `providedIn: 'root'`  | genuinely app-wide state (auth, theme, toasts) and stateless singletons (api clients) | lives until the tab closes; you must reset it by hand on sign-out |
| **route `providers`** | state shared by the routes under one parent and meaningless outside them              | destroyed with the route; scoping is enforced, not remembered     |
| component `providers` | one instance per component instance (a wizard, a repeated widget with its own state)  | duplicated per instance by design                                 |

**If N sibling routes must share state, give them a path-less parent route with `providers` — that is the mechanism, not a compromise:**

```ts
export const routes: Routes = [
  {
    path: "",
    providers: [DateRangeStore], // one instance for these three routes
    children: [
      {
        path: "calendar",
        loadComponent: () => import("./pages/calendar.page"),
      },
      { path: "reports", loadComponent: () => import("./pages/reports.page") },
      { path: "items/:id", loadComponent: () => import("./pages/item.page") },
    ],
  },
];
```

Navigating away from the whole group destroys the store; navigating between the three keeps it. Root scope would give the same sharing plus a leak into every other screen, plus a `reset()` you must remember to call from sign-out.

**Red flag:** if the justification for `providedIn: 'root'` is "nothing else will inject it" or "we'll reset it on logout", the state wanted a route provider. Discipline is not a scope. The exception is a project that can name why root is required — sign-in that never reloads the page, or a dialog opened from the shell outside every route injector — and then the sign-out sweep is the documented price of a chosen scope, not a workaround for an unchosen one.

Route params reach a page as `input()` via `withComponentInputBinding()` — not by injecting `ActivatedRoute` and subscribing. Guards protect routes; resolvers only for data the page cannot render without.

## Signal boundaries per layer

Which primitive belongs where is a layering question, not a style one.

| Primitive                       | Belongs at                                                                                                           | Not at                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `input()` / `output()`          | every component boundary; the only channel into a presentational component                                           | —                                                       |
| `model()`                       | a two-way control (picker, toggle) whose value the parent owns                                                       | a store's public state                                  |
| `signal()`                      | the one layer that owns the value — usually the store; page-local UI state (open tab, dialog flag) stays in the page | duplicated in both store and page                       |
| `computed()`                    | anywhere a value is derived; the default for everything that is not owned                                            | —                                                       |
| `linkedSignal()`                | local state that must reset when an input changes (form draft keyed on the selected record)                          | a store's source of truth                               |
| `resource()` / `httpResource()` | the layer that owns the async read — store, or a page for a read-once view; keyed on the signals it depends on       | a presentational component                              |
| `effect()`                      | escaping to non-Angular land: focus, storage, third-party widgets, analytics                                         | **triggering loads or syncing one signal into another** |

**`effect(() => void this.load(this.key()))` is a resource with worse cancellation, no loading state, and a race on rapid changes.** Key a `resource()` on the signal instead, or call an explicit method from the event that caused the change. If the project has decided on hand-rolled stores over `resource()`, the load trigger is still an explicit call from the page, not a constructor effect.

State that is derived from other state is never stored: `computed()`. A `signal` written from an `effect` that watches another `signal` is the bug this table exists to prevent.

## Shared kit vs feature UI

**The injection test decides the folder, and it beats the reuse count.**

- Injects nothing from `features/` or a data layer, speaks only in primitives and shared types → `shared/ui/`.
- Injects a store or api client → it belongs to that feature, in `features/<name>/ui/`, however many screens render it.

**Cross-feature widgets:** when feature B's screen must show feature A's data, A exports the widget from its own `index.ts` and keeps its store; B imports and renders it. Do **not** relocate that widget into the shared kit to "make it shared" — that inverts the dependency, and every feature that touches the kit now drags A's store into its graph.

If two features need the same _look_ but different domain types, the shared piece is a dumb component parameterised by primitives; each feature keeps a thin wrapper that maps its own type into it. Copy-pasting the sibling's component into your feature is the right call only when the shapes are genuinely unrelated — say so explicitly, don't drift into it.

## Bundle budgets and lazy loading

- Every feature route lazy (`loadChildren` / `loadComponent`). The initial bundle is the shell, router, core singletons and the first screen.
- **A widget rendered by an eagerly-loaded shell or the landing screen is in the initial chunk.** Cross-feature summary widgets on a dashboard are the usual way a "lazy" feature ends up eager — check the chunk before adding one.
- `@defer` for heavy below-fold content and anything pulling a large third-party dependency (editors, charts, maps); `on viewport` / `on interaction` over `on immediate`.
- Keep budgets in `angular.json` (`initial` and `anyComponentStyle`) and read the size table on every build — a new warning is a finding, not noise.
- Root-provided services land in whichever chunk first injects them and are shared after; they are not a reason to keep a feature eager.

## Quick Reference

| Question                           | Answer                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Where does a new domain go?        | `features/<name>/` with `data/`, `pages/`, `ui/`, `index.ts`, its own `routes.ts` |
| Who calls HTTP?                    | the api client, called only by its store                                          |
| Who decides what loads?            | the routed page                                                                   |
| Store needs another store's value? | page passes it as an argument                                                     |
| Component needs to write?          | container calls the store; leaves emit outputs                                    |
| Shared by three features?          | shared only if it injects nothing; otherwise it stays in its feature              |
| State for three sibling routes?    | path-less parent route + `providers`                                              |
| Load on param change?              | route `input()` + `resource()` keyed on it                                        |
| Derived value?                     | `computed()`, never a written signal                                              |
| Widget on the dashboard?           | check which chunk it lands in first                                               |

## Red Flags

Each of these is a placement decision being argued rather than made:

- "Three screens use it, so it goes in the shared kit" — reuse count never overrides the injection test.
- "Nothing else will inject it" or "we'll reset it on sign-out" — that is a description of a scope, not an enforcement of one.
- "This row owns its own writes, like the card next door" — precedent for a leaky boundary is not a reason to leak.
- "The store can just read the other store, it's simpler" — simpler to type, invisible to the caller.
- "An `effect` keeps them in sync automatically" — that is either a `computed` or a load trigger in the wrong layer.
- "Copying the sibling component avoids importing its types" — the fix for a bad type dependency is a domain-agnostic component, not a second copy.
- "The existing code already does it this way" — match a convention for locations; do not inherit a boundary violation.

## Common Mistakes

- **Store-injecting component in the shared kit.** The kit now imports a feature; the dependency arrow is backwards and the "reusable" component is reusable nowhere.
- **`providedIn: 'root'` for everything**, then a hand-written `reset()` per store wired into sign-out to undo the scope you chose. Where root is deliberate (see Routing and DI placement), the mistake is instead the store nobody added to the sweep.
- **Store reading another store** instead of taking the value as an argument.
- **A root-scoped store that patches whatever the server eventually answers**, with no check that the session and the key it asked about are still the current ones.
- **Api client injected by a page or component** "just for one call".
- **Leaf presentational components performing writes** because the container would have to pass one more output.
- **`effect()` as the data-loading trigger**, or as a way to copy one signal into another.
- **Deep imports across features** (`features/orders/data/orders.store`) that make the public entry point a fiction.
- **Barrel file for everything**, re-exporting a feature's internals and defeating both the boundary and tree-shaking. `index.ts` exports the public surface, not the folder.
- **Feature folder that cannot be deleted** without touching five others — the slice is wrong regardless of how tidy the files look.
