---
name: ng-signalstore
description: Use when adding or changing state held in an NgRx SignalStore (`signalStore`, `withState`, `withComputed`, `withMethods`, `withEntities`, `rxMethod`) — shared or feature state, a derived value, a collection, a request the store makes and its loading and error state — or when reviewing a store. Not for NgRx Store with actions and reducers, or for a plain signal service.
license: MIT
metadata:
  author: alfredoperez
  version: "1.2.0"
---

# Angular SignalStore Best Practices

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

NgRx SignalStore rules for signal-based local and feature state management. The code example for each rule is in [AGENTS.md](AGENTS.md).

## When to Apply

- Creating or modifying SignalStore-based state management
- Integrating RxJS side effects with `rxMethod`
- Managing collections with `withEntities`

## Rules

| Rule | Impact | Description |
|------|--------|-------------|
| Use rxMethod for RxJS Integration | MEDIUM | Debounce, switchMap, and other RxJS operators in stores |
| Use SignalStore for Shared State | HIGH | Signal-based reactivity without full NgRx overhead |
| Use withComputed for Derived State | MEDIUM | Centralized memoized derivation logic |
| Use withEntities for Collections | MEDIUM | O(1) lookups and standardized CRUD operations |

## Async in a store

Every request a store makes follows one shape:

- The method is an `rxMethod`, so a caller passes a value or a signal and gets nothing back to subscribe to.
- The request is wrapped in `tapResponse` (from `@ngrx/operators`), which handles `next` and `error` and keeps the stream alive after an error.
- Loading and error live in a call-state feature: `withCallState` from the NgRx toolkit, or a project `signalStoreFeature` with the same shape (`isLoading`, `isLoaded`, `error`). A component reads those signals; it never tracks its own `loading` flag for a store request.
- No store method returns an Observable or a Promise. A component that needs to act after the request reads the store's signals in a `computed` or an `effect`.
- No injection token that swaps the store for a fake one in a preview or a demo page. A preview provides the real store with a fake API service behind it, so the page runs the same code the app runs.

Before: the method returns an Observable the component subscribes to, and loading is the component's problem.

```typescript
export const OrdersStore = signalStore(
  withState({ orders: [] as readonly Order[] }),
  withMethods((store, api = inject(OrdersApi)) => ({
    load(customerId: string): Observable<readonly Order[]> {
      return api.list(customerId).pipe(tap((orders) => patchState(store, { orders })));
    },
  })),
);
```

After: the store owns the request and its call state.

```typescript
export const OrdersStore = signalStore(
  withState({ orders: [] as readonly Order[] }),
  withCallState(),
  withMethods((store, api = inject(OrdersApi)) => ({
    load: rxMethod<string>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap((customerId) =>
          api.list(customerId).pipe(
            tapResponse({
              next: (orders) => patchState(store, { orders }, setLoaded()),
              error: (error: unknown) => patchState(store, setError(error)),
            }),
          ),
        ),
      ),
    ),
  })),
);
```

The screen calls `store.load(customerId)` (or passes the `customerId` signal once) and binds `store.orders()`, `store.isLoading()` and `store.error()`.
