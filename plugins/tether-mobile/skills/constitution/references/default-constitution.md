# Default constitution

In force when a project has no constitution file, and the base a project file is read on top of.

| Id | Rule | Check |
|---|---|---|
| CON-1 | Functional TypeScript: `map`/`filter`/`reduce`/`find`/`some`, spreads, guard clauses. No `for` or `while`, no `push` or index assignment, no `let`. | `for (`, `while (`, `.push(`, `let ` in a non-test file |
| CON-2 | Absence is handled at the edge: the type carries `\| undefined`, read with `?.`, defaulted with `??`, tested with a named guard (`isNullish`, `isNonNullish`, point-free in `filter(isNonNullish)`). Never an operator comparison against `null` or `undefined`, never `!`. A positive amount is `(n ?? 0) > 0`. | `== null`, `!= null`, `=== undefined`, `typeof … === 'undefined'`, a postfix `!` |
| CON-3 | State lives in the store, the server cache or a hook. Never a module-level variable that changes, never a class instance holding state. | a module-level `let`; a new `class` |
| CON-4 | Hooks are called at the top level with complete dependency lists. A dependency is never left out and never silenced. | `eslint-disable` beside a hook; a hook inside a condition or a loop |
| CON-5 | A component is a function with a `Props` type. No class component, no `any` in a prop, no value computed in the body that a selector or `useMemo` over stable inputs can hold. | `extends Component`, `: any` in a `Props` type |
| CON-6 | No hardcoded width or height on a layout box: flex, padding, margins and theme spacing. An image or icon keeps its fixed size. | a numeric `width` or `height` on a non-image style |
| CON-7 | A comment carries a business or backend reason only, never a description of the code. | a comment restating the next line; JSDoc on an obvious member |
| CON-8 | A test sits beside every changed behaviour and fails without the change. | a behaviour change with no test change beside it |
| CON-9 | Reuse before build: an existing hook, component, formatter or core wrapper is extended, never wrapped or duplicated. | a wrapper around an existing hook; a second formatter for one value |
| CON-10 | Utils are function declarations grouped by concern, one `<concern>.util.ts` with one test; private helpers are module-level functions. | `export const x = (` for a util |

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
