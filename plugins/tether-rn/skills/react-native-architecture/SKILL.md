---
name: react-native-architecture
description: Use when deciding where a React Native file belongs or whether one module may import another - adding a feature or screen, splitting a screen into components, placing a card or widget several screens render, choosing between store, query cache and local state, adding a download, upload or other non-axios request, wrapping a native module, permission, config or keychain read, choosing route params, opening a screen from a push or deep link, or untangling a cross-feature or circular import. Structural placement and dependency direction for bare React Native and Expo apps; for the rule ids use react-native-conventions.
---

# React Native Architecture

Read `.claude/tether-rn.md` first; where it differs from this file, it wins.

## Overview

This skill answers two questions only: **where does this file go**, and **may this file import that one**. The rules themselves, with the ids plans and reviews cite (`LAY-1`, `NET-2`, `NAV-1`, …), are in `react-native-conventions`; this skill is the reasoning behind them. Where the two disagree, the conventions win, and the rules file wins over both. Performance and navigator UI are out of scope.

Two invariants generate every rule below:

1. **Dependencies point one way:** `app → features → shared → core`. Nothing in `shared/` or `core/` knows a feature exists.
2. **A file's layer is set by what it imports, not by how many screens render it.** "Three screens use it" makes a thing reused; it does not move a store-connected component into the shared kit.

## Feature slicing

```
src/
  app/                 providers, root navigator, linking config, push bootstrap
  core/                http client + auth headers, config, storage, device/ (permissions, files, push)
  shared/ui/           domain-agnostic presentational kit
  shared/hooks|utils/  domain-agnostic helpers
  features/
    orders/
      api.ts           endpoints, DTO ↔ model mapping
      slice.ts         the feature's state in one file: reducer, thunks, selectors (or its query hooks)
      screens/         one folder per routed screen
      ui/              feature-private components
      public/          the only files another feature may import: one export per file
```

- **A feature's public surface is the files in `public/`, imported by path.** `features/chat` may import `features/orders/public/order-card`, never `features/orders/slice` or `features/orders/ui/...`. Enforce it with an ESLint import restriction, not with memory.
- **No `index.ts` barrel for a feature or for the shared kit.** Metro does not tree-shake by default: importing one name from a barrel evaluates every module it re-exports and makes require cycles easy. Import the file.
- If removing a feature means editing five unrelated folders, the slice is wrong.

## Layers and the import rule

| Layer | Owns | May import | Must not import |
| --- | --- | --- | --- |
| **core** | one module per outside-world capability: HTTP client, config, keychain, permissions, files, push | native modules, `Platform` | `features/`, the store, navigation, React components |
| **feature api** | endpoints and mapping for one domain | `core` HTTP | the store, React, navigation, toasts |
| **feature state** | domain state and writes | its own api | another feature's state file, navigation, UI |
| **screen** | orchestration: what loads, what the route means, when to ask the user for something | its feature's state and ui, navigation, `core/device`, other features' `public/` | axios, `fetch`, blob/file libraries, `react-native-config` |
| **feature ui** | presentation of one domain's shapes | its own feature's state (read by id, as granular as useful), props | any api, another feature's state file |
| **shared ui** | domain-agnostic presentation | RN primitives, theme, shared types | `useSelector`/`useDispatch`/store or query hooks, any api, `useNavigation`, anything from `features/` |

**The import test decides the folder, and it beats the reuse count.** A component that imports a store hook, a thunk, a query hook, an api function or `useNavigation` belongs to the feature that owns that data, in `features/<name>/ui/` (or `public/` when other features render it), however many screens use it. If two features need the same look, the shared piece takes primitives as props and each feature keeps a thin connected wrapper.

Inside a feature, connecting many small components to the store is correct: a row that selects its own record by id re-renders less than a parent that passes it down. The boundary this skill guards is the shared kit, not the leaf.

## One transport identity

Base URL and auth headers are built by **one exported function in `core/`**. The axios interceptor calls it, and so does every other transport: a `react-native-blob-util` download, a multipart `fetch` upload, a WebSocket handshake. A second header builder next to the first is the bug; when a token rule changes, one of them is forgotten.

## Core does not talk to the user

A `core` or api function takes what it needs and returns a result. It does not prompt for a permission, open a file viewer, show a toast or navigate. Those are decisions about the user's attention and belong to the screen, or to a feature hook the screen calls.

```ts
// core/device/files.ts — capability, no UI
export function downloadToFile(url: string, dest: string, onProgress?: (p: number) => void): Promise<string>;

// core/device/permissions.ts — capability, returns a result
export function ensureStoragePermission(): Promise<boolean>;

// features/orders/ui/use-invoice-download.ts — the sequence the user experiences
export function useInvoiceDownload(orderId: string) {
  const [progress, setProgress] = useState<number | null>(null);
  const start = async () => {
    if (!(await ensureStoragePermission())) return 'denied';
    const path = await downloadToFile(invoiceUrl(orderId), destFor(orderId), setProgress);
    await openFile(path);
    return 'opened';
  };
  return { progress, start };
}
```

Each native **capability** has one wrapper module. `Config.X`, a keychain read, a `PermissionsAndroid` call or an API-level check (`Platform.Version`) in a screen or an api file means the wrapper is missing or bypassed.

**Presentation is different.** A style value or a small layout difference uses `Platform.OS` / `Platform.select` in the component; a component that diverges substantially is split into `Name.ios.tsx` and `Name.android.tsx`. Both are fine in any UI layer.

## State placement

| State | Lives in |
| --- | --- |
| Server data that two or more screens show, or that one screen invalidates for another | the project's server cache (RTK Query, TanStack Query) if it has one, else a slice normalized by id |
| Server data one screen reads once | that screen's query hook or local state |
| Open tab, sheet visibility, form draft | `useState` in the screen; dispatch once when the form is submitted |
| Anything derivable from other state | a selector, never stored |
| Functions, promises, class instances | nowhere in the store or in actions |
| Session tokens, passwords | keychain wrapper in `core`; never AsyncStorage, never a persisted slice |
| Which screen is showing | the navigator, never the store |

**`core/config` holds environment values, not secrets.** Anything read through `react-native-config` or dotenv ships in the bundle in plain text. A key that must stay secret lives behind a backend endpoint; moving it into a config file changes where it is typed, not who can read it.

## Navigation boundaries

- **Route params hold the minimum needed to show the screen: ids and small JSON-serializable state.** No domain objects, no functions. The data itself comes from the store or cache. A screen must render from its params alone, because a deep link or a restored navigation state will give it nothing else.
- **A result goes back through shared state, or as params to the previous screen (`popTo`).** Never through a callback passed in params.
- **Push notifications and deep links enter through the `linking` config** (`getInitialURL` for a cold start, `subscribe` for a running app), which maps a URL to a route and params. Handling them by hand with a navigation ref is error-prone and is not the default.
- **A navigation ref is the rare case**: code with no navigation object, such as an HTTP interceptor signing the user out. Create one in `app/`, and check `isReady()` or wait for `onReady` before dispatching.
- **Types follow the API the app already uses.** Static API: params come from `StaticScreenProps` on the screen and the root navigator is declared once for global inference. Dynamic API: each navigator has a `ParamList` type alias, nested with `NavigatorScreenParams`. Either way, do not annotate `useNavigation<...>()` by hand at call sites; that annotation is not checked. `navigation: any` hides a broken param contract.
- Cross-feature navigation uses the route name and an id. It never imports the other feature's screen component.
- Deep links are not private. A URL carries ids, never tokens or personal data.

## Legacy trees

In a codebase that is not sliced this way (`src/components`, `src/screens`, `src/services`):

- New files go in the target location, or the nearest existing equivalent, by the import test: a connected card goes beside the screens of the feature that owns its data, not in `src/components`.
- Match the existing convention for names and locations. Do not inherit a boundary violation because a neighbour has one.
- Migrate a file when the ticket already changes it. A working neighbour is a follow-up, named in the hand-off.

## Quick Reference

| Question | Answer |
| --- | --- |
| Card shown on three screens, reads the store? | owning feature's `public/`, imported by path |
| May a list row read the store itself? | yes, inside its own feature |
| Who builds auth headers for a blob download? | the same `core` function the axios interceptor uses |
| Who asks for a permission or opens the file? | the screen or its feature hook, calling `core/device` |
| Where is `react-native-config` read? | once, in `core/config`, and it holds no secrets |
| What goes in route params? | ids and small serializable state |
| How does a list learn the detail screen changed something? | shared state, or params via `popTo`; not a callback |
| How does a push open a screen from a cold start? | `linking.getInitialURL` |
| Shared kit component needs data? | it takes props; a feature wrapper connects it |
| `index.ts` re-exporting a folder? | no; import the file |

## Red Flags

- "Three screens use it, so it goes in `components/`" — reuse count never overrides the import test.
- "It is one line per screen if the card fetches for itself" — true, and it still belongs to its feature.
- "The helper can ask for the permission too, it keeps the screen small" — the transport now decides when the user is interrupted.
- "This download needs its own headers, axios cannot stream" — a second transport, not a second identity.
- "Passing the object saves a fetch" — and breaks the deep link and goes stale.
- "It is in `.env` now, so it is not in the code" — it is in the bundle.
- "A barrel makes the imports tidy" — and loads every screen of the feature to read one selector.
- "The existing code already does it this way" — a convention for locations, not a licence for the violation.

## Sources

Checked against: React Navigation 7 docs (Passing parameters, Type checking with TypeScript, Deep linking, NavigationContainer); Redux Style Guide (feature folders with single-file logic, where state should live, no non-serializable values, minimal state, normalized state, connect more components, form state); React Native docs (Security, Platform-Specific Code); the `react-native-best-practices` skill (avoid barrel exports). Re-check when the app moves to a new major of React Navigation.
