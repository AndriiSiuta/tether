# Default constitution

In force when a project has no constitution file, and the base a project file is read on top of.

| Id | Rule | Check |
|---|---|---|
| CON-1 | Functional TypeScript: `map`/`filter`/`reduce`/`find`/`some`, spreads, guard clauses. No `for` or `while`, no `push` or index assignment, no `let`. | `for (`, `while (`, `.push(`, `let ` in a non-spec file |
| CON-2 | Absence is handled at the edge: the type carries `\| undefined`, read with `?.`, defaulted with `??`, tested with a named guard (`isNullish`, `isNonNullish`, point-free in `filter(isNonNullish)`). Never an operator comparison against `null` or `undefined`, never `!`. A positive amount is `(n ?? 0) > 0`. | `== null`, `!= null`, `=== undefined`, `typeof … === 'undefined'`, a postfix `!` |
| CON-3 | State lives in a factory function closing over `signal()`s and returning a record of functions, or in a signal store. Never a class with constructor state. | a new `class` that is not a component, directive or pipe |
| CON-4 | `inject()` inside an injection context only: a field initialiser, an `InjectionToken` factory, a store's `withMethods`. Never constructor parameters. | `constructor(private` |
| CON-5 | Components are standalone and `OnPush` with `input()`/`output()`/`computed()`; a template calls no method a `computed` can replace. | `@Input(`, `@Output(`, a method call in a binding |
| CON-6 | No hardcoded width or height on a layout box: flex or grid, padding, margins. An image thumbnail keeps its fixed size. | `w-[`, `h-[`, `w-<n>`, `h-<n>` on a non-image element |
| CON-7 | A comment carries a business or backend reason only, never a description of the code. | a comment restating the next line; JSDoc on an obvious member |
| CON-8 | A spec sits beside every changed behaviour and fails without the change. | a behaviour change with no spec change beside it |
| CON-9 | Reuse before build: an existing service, pipe, dialog, icon or component is extended, never wrapped or duplicated. | a wrapper around an existing service; a second formatter for one value |
| CON-10 | Utils are function declarations grouped by concern, one `<concern>.util.ts` with one spec; private helpers are module-level functions. Models are one type per file. | `export const x = (` for a util; two types in one `.model.ts` |

## Before and after

```ts
// Before: CON-1, CON-2, CON-10
export const overdueTotal = (invoices: Invoice[]) => {
  let total = 0;
  for (const invoice of invoices) {
    if (invoice.paidAt == null) total += invoice.amount!;
  }
  return total;
};

// After
export function overdueTotal(invoices: readonly Invoice[]): number {
  return invoices
    .filter((invoice) => isNullish(invoice.paidAt))
    .reduce((sum, invoice) => sum + (invoice.amount ?? 0), 0);
}
```
