# DI scope and route providers

Choosing an injector is choosing a lifetime. Pick the shortest one that spans every consumer.

## The three scopes

```ts
@Injectable({ providedIn: 'root' })   // one per application, until the tab closes
@Injectable()                          // no default; provided by a route or a component
```

A service with no `providedIn` and no provider anywhere is a compile-time-clean runtime error — always pair `@Injectable()` with the `providers` array that supplies it.

| Scope                 | Instance count                         | Destroyed when                | Right for                                                              |
| --------------------- | -------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| root                  | 1                                      | never (page unload)           | auth session, theme, toasts, config, stateless api clients             |
| route `providers`     | 1 per activation of that route subtree | navigating out of the subtree | state a group of screens shares and nothing else needs                 |
| component `providers` | 1 per component instance               | component destroyed           | per-instance state: a wizard, a repeated widget, a dialog's form model |

## Sharing across sibling routes

The common mistake is concluding that because three _sibling_ routes need one instance, only root can provide it. A path-less parent route creates exactly the injector you want:

```ts
export const routes: Routes = [
  {
    path: "",
    providers: [DateRangeStore, ReportsStore],
    children: [
      {
        path: "calendar",
        loadComponent: () =>
          import("./pages/calendar.page").then((m) => m.CalendarPage),
      },
      {
        path: "reports",
        loadComponent: () =>
          import("./pages/reports.page").then((m) => m.ReportsPage),
      },
      {
        path: "items/:id",
        loadComponent: () =>
          import("./pages/item.page").then((m) => m.ItemPage),
      },
    ],
  },
];
```

- The parent contributes no path segment, so URLs are unchanged.
- Moving between the three children keeps one `DateRangeStore`.
- Leaving the group destroys it — no stale range when the user comes back tomorrow, and nothing to unwind on sign-out.
- Adding a fourth screen to the group is one line; nothing else in the app can reach the store by accident.

Use `loadChildren` when the whole group should also be one lazy chunk:

```ts
{ path: 'billing', loadChildren: () => import('./features/billing/billing.routes').then(m => m.routes) }
```

Providers declared on a lazy route are created when the route activates and torn down with it, so lazy loading and scoping compose.

## Root scope and manual teardown

Root-scoped state has no destroy hook you can rely on for a user session. Every root store holding user data needs an explicit `reset()`, and something must call all of them on sign-out:

```ts
clear(): void {
  this.orders.reset();
  this.reports.reset();
  // ...one line per store, forever, and the bug is the line nobody added
}
```

That list is the price of root scope. It is worth paying for state that genuinely spans the app, and not worth paying for state three screens share — that is what the route provider replaces. When you find yourself writing "nothing else will inject it" as the justification for root, you have described a scope, not enforced one.

The reset list is only half the price. A request that was in flight when the session ended still resolves, and its patch lands in the store the next user sees; a keyed read (`loadThing(id)`) that a newer key superseded does the same. So every `await` inside a root-scoped store captures a generation or request token before the call and drops the answer if it changed while the call was out — on a deduping load wrapper, on a per-key load and on a latest-wins load alike. `reset()` bumps the generation, which is what makes the sign-out sweep sufficient rather than merely tidy. Route-scoped state gets this for free: the injector is destroyed with the route, and there is no next user to hand a stale answer to.

## `DestroyRef` and cleanup

Whatever the scope, cleanup belongs to the injector, not the component tree:

```ts
private readonly destroyRef = inject(DestroyRef);
constructor() {
  const id = setInterval(() => this.poll(), 30_000);
  this.destroyRef.onDestroy(() => clearInterval(id));
}
```

In a route-provided service this fires on navigation out of the subtree; in a root service it never fires, which is another way to notice the scope is wrong.

## Injection tokens for configuration

Configuration crosses layers without creating imports:

```ts
export const ORDERS_CONFIG = new InjectionToken<OrdersConfig>('orders.config');

// app.config.ts
{ provide: ORDERS_CONFIG, useValue: { pageSize: 50 } }
```

A feature reads the token; it never imports the app's config object. This is how a feature stays independently testable and independently shippable — and why an api client may inject tokens but not a store.

## Guards, resolvers, and where they attach

- Guards attach to the highest route that needs them (the authenticated shell), not repeated on every child.
- Resolvers only for data a page genuinely cannot render without; otherwise fetch in the page and render a loading state, which keeps the navigation responsive.
- Both are functional (`CanActivateFn`, `ResolveFn`) and use `inject()`; they run in the route's injector, so they can read route-provided services.
