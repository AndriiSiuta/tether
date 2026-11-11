---
name: react-native-conventions
description: Use when placing, writing, planning or reviewing code in a React Native app - a new feature, screen, route, component, hook, slice, api call, native capability, config value or test - before the code is written and again before the work is called done. Holds the rule ids agents cite and that a project can override.
---

# React Native conventions

Read `.claude/tether-rn.md` first; where it differs from this file, it wins.

These are the defaults for one bare React Native or Expo app in TypeScript, with React Navigation and a client store. Every rule has an id; plans, reviews and reports cite the id, not the prose. The reasoning behind the placement rules is in `react-native-architecture`.

## Overriding a rule

A project describes itself in `.claude/tether-rn.md`. Without the file, the defaults below apply. The keys:

| Key | Holds | Default |
|---|---|---|
| `layout` | The folder each layer lives in: `{ app, core, shared, features }` | `src/app`, `src/core`, `src/shared`, `src/features` |
| `alias` | The import prefix that maps to the source root | `@org/` |
| `state` | The state approach for new code | Redux Toolkit slices, one file per feature |
| `navigation` | The navigation library and the API style in use | React Navigation, the style the app already uses |
| `i18n` | The translation library and the language files | none; `COPY-1` is then `n/a` |
| `verify` | The one command that proves a task; `{base}` becomes the task's base commit | `npx tsc --noEmit && npx eslint . && npx jest --changedSince={base}` |
| `paths` | `{ specs, plans, reports }` | `docs/specs`, `docs/plans`, `docs/reports` |
| `overrides` | `- <rule id>: <the project's rule>` lines; the line replaces that rule | none |
| `facts` | Lines every agent treats as true for this project | none |

```markdown
layout: { app: src/navigation, core: src/services, shared: src/components, features: src/screens }
alias: @org/
state: Redux Toolkit slices under src/services/redux/slices
verify: npm run verify -- --base {base}
overrides:
- LAY-2: A feature folder holds its screens at the root; its api calls stay in the shared api folder until that file is split.
facts:
- The orders API returns amounts in minor units.
```

An override names one id. A rule the file does not name keeps its default. A rule that does not fit the project is overridden, never silently ignored. The `layout` key renames folders; it does not relax a rule: `LAY-5` holds for whatever folder `shared` maps to.

## Rules

| Id | Rule | Guard |
|---|---|---|
| `LAY-1` | Four layers, pointing down: app → features → shared → core. Nothing in shared or core imports a feature; no cycles | `GUARD-1` |
| `LAY-2` | A feature folder holds `api.ts`, one state file (`slice.ts` or its query hooks), `screens/<screen>/`, `ui/` and `public/`. No technical folder shared across features (`hooks/`, `services/`) at the feature level | review |
| `LAY-3` | Another feature imports only files under `features/<name>/public/`, by file path | `GUARD-1` |
| `LAY-4` | No `index.ts` that re-exports a folder; import the file | `GUARD-2` |
| `LAY-5` | The import test: a component that imports a store or query hook, a thunk, an api function or `useNavigation` lives in the feature that owns that data. A shared component imports none of them, however many screens render it | `GUARD-1` |
| `NET-1` | Only a feature's `api.ts` calls the HTTP client. A screen or component never imports axios, `fetch` wrappers or a blob or file transfer library | `GUARD-1` |
| `NET-2` | One function in core builds the base URL and auth headers; every transport (the HTTP client, a file download, an upload, a socket) calls it | review |
| `NET-3` | A core or api function returns a result. It never prompts for a permission, shows a toast, opens a viewer or navigates | review |
| `DEV-1` | One wrapper module in core per native capability: config, secure storage, permissions, files, push. No `PermissionsAndroid`, keychain call, build-config read or API-level check outside it | review |
| `DEV-2` | A presentational platform difference uses `Platform.select` when small and `Name.ios.tsx` / `Name.android.tsx` when the component diverges | review |
| `STATE-1` | Server data that two screens show, or that one screen invalidates for another, lives in the project's server cache or a slice normalized by id | review |
| `STATE-2` | Screen-local UI state and form drafts are component state; the store hears once, on submit | review |
| `STATE-3` | A value derivable from other state is a selector, never stored | review |
| `STATE-4` | No function, promise or class instance in the store or in an action | the store's serializability check |
| `STATE-5` | Session tokens and passwords go through the secure-storage wrapper only: never plain key-value storage, never a persisted slice | review |
| `NAV-1` | Route params are ids and small JSON-serializable state. No domain object, no function. The screen renders from its params alone | review |
| `NAV-2` | A result returns through shared state or as params to the previous screen, never through a callback param | review |
| `NAV-3` | Push notifications and deep links enter through the `linking` config (`getInitialURL`, `subscribe`). A navigation ref is used only where no navigation object exists, behind `isReady()` | review |
| `NAV-4` | Params are typed: a `ParamList` per navigator, or `StaticScreenProps` with the static API. No `navigation: any`, no hand-annotated `useNavigation<...>()` | `tsc` |
| `NAV-5` | A URL or deep link carries ids, never a token or personal data | review |
| `CMP-1` | A new component is a function component with a `Props` type; no class component | review |
| `CMP-2` | Styles are `StyleSheet.create` objects in the component file or a sibling `styles.ts`, built from theme tokens. An inline style object only for a value computed at render | review |
| `CMP-3` | No comments in TS or TSX; other people's comments stay | review |
| `CMP-4` | A list of unknown length is a virtualized list with a stable `keyExtractor`, never `.map` inside a `ScrollView` | review |
| `CMP-5` | Every pressable element has an accessibility role and label, and every element a test asserts has a `testID` | review |
| `CFG-1` | Environment values are read once, in the core config module, from build-time configuration. No host, key or environment switch literal in source | `GUARD-3` for keys |
| `CFG-2` | Nothing that must stay secret is in source or in build-time configuration; it lives behind a backend endpoint | `GUARD-3` |
| `LOG-1` | No bare `console.*`. Logging goes through the project logger, is silent in release and never carries a header, token or request body | lint `no-console` |
| `COPY-1` | With an `i18n` key set, every user-visible string is a translation key present in every language file | review |
| `NAT-1` | A change under `android/` or `ios/` (Gradle, Podfile, manifest, `Info.plist`, entitlements) is its own task, says what it does on both platforms and never adds signing material | review |
| `NAT-2` | A new native dependency is asked for before it is added, with its New Architecture support and the rebuild it requires named | review |
| `TEST-1` | A co-located `*.test.ts(x)` sits beside every changed behaviour | review |
| `TS-1` | Code compiles under `strict` | `tsc` |
| `GUARD-1` | A boundary lint enforces `LAY-1`, `LAY-3`, `LAY-5` and `NET-1` | — |
| `GUARD-2` | A no-barrel lint enforces `LAY-4` | — |
| `GUARD-3` | A secret scan over the tree and history enforces `CFG-2` | — |

"review" means no automated check exists; the reviewer cites the id. What each guard fails on, and how to build one where the app lacks it: [references/guards.md](references/guards.md).

### Placement in practice

- A new screen in an existing domain is a folder under that feature's `screens/`, its routed component at the folder root and its private sub-components beside it (`LAY-2`).
- A hook or component one screen uses sits in that screen's folder; one two screens of the feature share sits in the feature's `ui/`; one another feature renders sits in `public/` (`LAY-3`).
- A card that reads the store and appears on three screens of three features is one file in the owning feature's `public/`, not a shared component (`LAY-5`).
- A download, an upload or a socket takes its headers from the core function the HTTP client uses (`NET-2`); the permission prompt and the file viewer are called by the screen's hook, not by the transfer function (`NET-3`, `DEV-1`).
- A screen opened from a push or a deep link gets an id and reads its record from the store or cache (`NAV-1`, `NAV-3`).

### A repository that is not laid out this way

The `layout` key names the real folders. New files then follow the rules in those folders: a connected card goes beside the screens of the feature that owns its data, not in the shared components folder. A file is moved to the target layout only by a task that already changes it; a working neighbour is a follow-up. An existing violation next to the change is not a licence to add another.

## Done when

1. Placement checked against `LAY-1`…`LAY-5` and `NET-1`…`NET-3`; no new barrel, no new deep import into another feature.
2. No new native call outside its core wrapper (`DEV-1`), no new literal host or key (`CFG-1`), no new `console.*` (`LOG-1`).
3. Route params added or changed are ids and serializable state (`NAV-1`), and typed (`NAV-4`).
4. The rules file's `verify` command, run with the task's base commit, passes, and its output is pasted.
5. A test sits beside every changed behaviour (`TEST-1`).
6. The report ends with `Files:`, `Red:`, `Checks:`, `Deferred:` and `Plan edits:`, or with a single `Blocked:` line.

## Common mistakes

- A store-connected card placed in the shared components folder because several screens use it (`LAY-5`).
- A second header builder beside the HTTP client's, written for a download because the client cannot stream (`NET-2`).
- A transfer helper that also asks for the storage permission and opens the file (`NET-3`).
- A domain object or an `onDone` callback passed in route params (`NAV-1`, `NAV-2`).
- A push handler that navigates through a ref instead of the `linking` config (`NAV-3`).
- A key moved from a constants file into build-time configuration and called secret (`CFG-2`).
- A token written to plain key-value storage, or a slice holding it added to the persisted set (`STATE-5`).
- A `Platform.Version` or `PermissionsAndroid` check inside a screen (`DEV-1`).
- An `index.ts` added to make imports shorter (`LAY-4`).
- A Gradle or Podfile edit folded into a feature task (`NAT-1`).
- A lint rule silenced instead of the file fixed.
