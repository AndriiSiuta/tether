# Layer boundaries

The full may-inject matrix, and the three refactors that come up most.

## May-inject matrix

Read a row as "a file of this layer may inject". Anything not listed is a boundary violation.

| | HttpClient | own api client | own store | another feature's public store | another feature's api/private store | Router / ActivatedRoute | dialog, toast, a11y |
|---|---|---|---|---|---|---|---|
| api client | yes | — | no | no | no | no | no |
| store | no | yes | — | no | no | no | no |
| routed page | no | no | yes | yes | no | yes | yes |
| feature container | no | no | yes | no | no | rarely | yes |
| feature leaf | no | no | no | no | no | no | no |
| shared ui | no | no | no | no | no | no | yes (a11y/id only) |

"Public store" means one exported from the other feature's `index.ts`. A store nobody exported is private, and reaching it through a deep import is the same violation as injecting an api client.

`ActivatedRoute` in a page is a smell but not a violation; prefer route `input()` bindings via `withComponentInputBinding()`. `ActivatedRoute` in a store *is* a violation — the store then only works under one route.

## Refactor 1: the store that reads another store

The symptom: a fetch silently depends on state the caller cannot see.

```ts
// Wrong: the dependency is invisible, and ReportsStore only works on screens that have a picker.
@Injectable({ providedIn: 'root' })
export class ReportsStore {
  private readonly api = inject(ReportsApi);
  private readonly dateRange = inject(DateRangeStore);   // hidden coupling

  async load(): Promise<void> {
    this.rows.set(await this.api.summary(this.dateRange.range()));
  }
}
```

```ts
// Right: the parameter is the contract. The page decides where the range comes from.
@Injectable()
export class ReportsStore {
  private readonly api = inject(ReportsApi);

  async load(range: DateRange): Promise<void> {
    this.rows.set(await this.api.summary(range));
  }
}

// reports.page.ts — orchestration lives here
protected readonly range = inject(DateRangeStore).range;
private readonly rows = resource({
  params: () => this.range(),
  loader: ({ params }) => this.reports.load(params),
});
```

The store is now renderable in a test, in a dialog, and on a screen with a different range source. The page is the only file that knows both halves — which is its job.

## Refactor 2: the leaf that writes

```ts
// Wrong: order-row injects the store, so it renders only where that store is provided.
@Component({ selector: 'app-order-row', /* ... */ })
export class OrderRowComponent {
  readonly order = input.required<Order>();
  private readonly store = inject(OrdersStore);        // leaf became smart
  protected toggle(): void { void this.store.toggle(this.order().id); }
}
```

```ts
// Right: intent out, decision up.
@Component({ selector: 'app-order-row', /* ... */ })
export class OrderRowComponent {
  readonly order = input.required<Order>();
  readonly toggled = output<string>();
}
```

The container — the page, or one container per screen region — owns `(toggled)="store.toggle($event)"`. One place to add optimistic rollback, one place to add a confirmation, one place to change when the rules change.

The exception that is not an exception: a *container* component may inject its own feature's store. What makes it a container is that it is the composition root for a region, not that it is convenient. If every row is a container, you have no boundary.

## Refactor 3: the cross-feature widget

Feature `home` must show an invoice summary owned by feature `invoices`.

```
Wrong                                   Right
shared/ui/invoices-summary.component.ts   features/invoices/ui/invoices-summary.component.ts
  injects InvoicesStore                     injects InvoicesStore
                                        features/invoices/index.ts
                                          export { InvoicesSummaryComponent }
                                        features/home/pages/home.page.ts
                                          imports it from 'features/invoices'
```

The wrong column puts a feature's store behind the shared kit, so every feature that imports anything from the kit sits one hop from `InvoicesStore`, and the kit can no longer be extracted or reasoned about on its own. The right column keeps one arrow, `home → invoices`, visible in the import line.

When the summary must appear on a dashboard that is eagerly loaded, that arrow also tells you the bundle consequence: `invoices`'s store and api client are now in the initial chunk. That is a decision to take deliberately — `@defer` the widget, or accept the bytes — not a surprise to discover in the build output.

## Splitting a shared look across domains

Two features want the same control with different domain types. Do not copy the component, and do not widen it to a union of both domains.

```ts
// shared/ui/dot-row.component.ts — knows nothing about orders or invoices
readonly filled = input.required<readonly boolean[]>();
readonly label  = input<string>('');
readonly picked = output<number>();
```

Each feature keeps a wrapper that maps its own type into those primitives. The shared file stays domain-agnostic (so it never has to change when a domain changes), and each feature owns its own mapping.

Copying the sibling's component wholesale is right only when the shapes are genuinely unrelated and the visual similarity is a coincidence. Write that reason down in the file; an unexplained near-duplicate reads as an accident and gets "helpfully" merged later.
