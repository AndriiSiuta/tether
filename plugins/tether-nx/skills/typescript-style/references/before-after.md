# Before / after

Each "before" is a pattern from an orders list table and its copies; each "after" is the shape the recipe asks for.

## 1. View state

Before — three signals, `undefined` doubling as "not loaded yet", a boolean that some copies wrote without the error branch:

```ts
private readonly loadedRows = linkedSignal<Order[] | undefined, Order[] | undefined>({
  source: () => (this.ordersResource.hasValue() ? this.ordersResource.value() : undefined),
  computation: (value, previous) => value ?? previous?.value,
});
readonly initialized = computed(() => this.loadedRows() !== undefined || this.ordersResource.status() === 'error');
readonly rows = computed(() => this.loadedRows() ?? []);
```

After — one union derived from what `resource()` already exposes; the template switches on `kind`:

```ts
type TableView<Row> = { kind: 'loading' } | { kind: 'ready'; rows: Row[] } | { kind: 'empty' } | { kind: 'error' };

private readonly keptRows = linkedSignal<
  { status: ResourceStatus; rows: readonly Order[] | undefined },
  readonly Order[] | undefined
>({
  source: () => ({
    status: this.ordersResource.status(),
    rows: this.ordersResource.hasValue() ? this.ordersResource.value() : undefined,
  }),
  computation: ({ status, rows }, previous) => (status === 'error' ? undefined : (rows ?? previous?.value)),
});

readonly view = computed<TableView<Order>>(() => {
  const term = this.searchTerm().trim().toLowerCase();
  const columns = this.visibleColumns();
  return deriveTableView({
    rows: this.keptRows(),
    hasFailed: this.ordersResource.status() === 'error',
    matches: row => term === '' || columns.some(column => cellText(row, column.id).includes(term)),
  });
});
```

`deriveTableView` (a pure helper in the workspace's `util` library, with `TableView` and `TableViewSource` in a sibling model file) reads the held rows before the error flag: signals are lazy, and an error-first check would leave the pre-error rows to reappear on the next customer switch. The `linkedSignal` computation drops the held rows when the status is `'error'`, so a list from another customer never outlives a failed reload. `ready.rows` is typed `Row[]`, the array the table component owns and sorts in place through its custom-sort callback; it is always a fresh `filter` copy, so the source rows stay untouched.

```html
@let state = view();
@switch (state.kind) {
  @case ('loading') {}
  @case ('ready') { <app-orders-grid [rows]="state.rows" … /> }
  @default { <div class="no-data-row">{{ 'orders.list.noDataMessage' | translate }}</div> }
}
```

The `undefined` still exists once, at the `linkedSignal` edge where Angular's API puts it; nothing downstream reads it.

## 2. Sort comparator

Before, copied into several containers:

```ts
const isNullishA = valueA === null || valueA === undefined;
const isNullishB = valueB === null || valueB === undefined;
if (isNullishA || isNullishB) { … return isNullishA ? 1 : -1; }
let result: number;
if (typeof valueA === 'number' && typeof valueB === 'number') { result = valueA - valueB; }
else { result = String(valueA).localeCompare(String(valueB), undefined, { numeric: true }); }
return result * event.order;
```

After, once in the `util` library's table utilities with its spec; `isNil` stands for the project's typed nullish helper:

```ts
export type CellValue = string | number | undefined;

export function compareCellValues(a: CellValue, b: CellValue, order: 1 | -1): number {
  if (isNil(a) && isNil(b)) return 0;
  if (isNil(a)) return 1;
  if (isNil(b)) return -1;
  const result = typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), undefined, { numeric: true });
  return result * order;
}
```

## 3. Cell values and search

Before: `getSortValue(row, field: string): string | number | undefined` over a property-path lookup, and a search that joined every cell into one string and substring-matched it.

After: a typed accessor per column id, and search as a predicate per column:

```ts
export const ORDERS_TABLE_COLUMNS = defineTableColumns<OrdersTableColumnDefinition>()([ … ]);
export type OrdersColumnId = (typeof ORDERS_TABLE_COLUMNS)[number]['id'];
const { isColumnId, cellText } = createCellText(ORDERS_TABLE_COLUMNS, ORDERS_CELL_VALUES);

const cellValue: Record<OrdersColumnId, (row: Order) => CellValue> = {
  'customer.name': row => row.customer?.name,
  number: row => row.number,
  priority: row => (row.lines.some(line => line.priority === 1) ? 1 : 0),
  …
};
```

Search is the `matches` predicate handed to `deriveTableView` (§1): `columns.some(column => cellText(row, column.id).includes(term))` over the visible columns; no separate `filteredRows` signal.

## 4. Class toggles

Before: `rowNgClass(row): Record<string, boolean>` bound as `[ngClass]="rowNgClass(row)"`, rebuilt per row per change detection.

After:

```html
<tr [class.order-row--no-pointer]="viewRestricted" [class.order-row--priority]="hasPriorityLine(row)">
```

## 5. Nullable at the edge

Before: `amountOf(line): number { const field = this.column().field; return field ? line[field] : undefined; }` — `undefined` returned from a `number`.

After: `amountOf(line): number | undefined`, and the template branch that renders it handles the absent case; or the amount cell types get a required `field` in the column model so the question never arises.

## 6. Dialog column selection

Before (copied from another table's settings dialog): `Object.keys(values.tableColumns).map(key => (values.tableColumns[key] ? key : null)).filter(value => value)` — a `(string | null)[]` passed where `string[]` is expected.

After: `Object.entries(values.tableColumns).filter(([, on]) => on).map(([key]) => key)`.
