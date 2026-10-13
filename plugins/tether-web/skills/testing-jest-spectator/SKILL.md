---
name: testing-jest-spectator
description: Use when writing or reviewing a Jest spec for an Angular component, service, store, pipe or util that uses Spectator — a new behaviour that needs its spec, a spec failing with "is not a known element", an input set after creation, a store method built on rxMethod, a resource that never leaves loading, a mock that hides the code under test.
---

# Testing with Jest and Spectator

Read `.claude/tether-web.md` first; where it differs from this file, it wins.

## Overview

One spec beside the file it tests, one `it` per behaviour, each failing without its change (`CON-8`). Spectator builds the unit, fixtures build the data, and only the edge (network, persistence, dialogs, router) is replaced. Recipes with full code: `references/recipes.md`; the `Recipe` column names the section (`§6` is `## 6.`), so read only that one. Spectator's helpers come from `@ngneat/spectator/jest`; Angular's from `@angular/core/testing`.

## The recipe

| Situation | Write | Recipe |
|---|---|---|
| A component | `const createComponent = createComponentFactory({ component: OrderCardComponent, providers: [...] })`; `createComponent({ props: { order: orderItem() } })`. Inputs are `input()` signals: `props` sets them at creation. | §2 |
| An input changes after creation | `spectator.setInput('order', orderItem({ status: 'shipped' }))`, then assert. Never write to the signal or the component field. | §2 |
| Content projection, a directive, an attribute host | `createHostFactory(OrderCardComponent)` and `createHost('<acme-order-card [order]="order"><span data-testid="slot">x</span></acme-order-card>', { hostProps: { order } })`. | §3 |
| A service with no state | `createServiceFactory({ service: InvoiceExportService, providers: [mockProvider(InvoicesApi, { export: () => of(blob) })] })`; `spectator.service`. | §5 |
| A signal store | `TestBed.configureTestingModule({ providers: [InvoiceStore, { provide: INVOICES_API, useValue: api }] })`, `TestBed.inject(InvoiceStore)`. Provide every token the store injects (API, persistence) with a stub; the store itself is real. | §6 |
| Querying, asserting | `spectator.query(byTestId('order-total'))`; every asserted node carries a `data-testid`, never a CSS class, tag path or `queryAll` index. Spectator's `toHaveText`, `toHaveClass`, `toExist`. | §2 |
| An output, a user action | `spectator.component.cancelled.subscribe(emitted)`, then `spectator.click(byTestId('cancel'))` or `spectator.typeInElement('ACME-7', byTestId('search'))`; Spectator runs change detection after each. | §2 |
| Data | A fixture function from the owning lib's `testing/` file, `orderItem(overrides)`, exported through its barrel and overridden by spread: `orderItem({ lines: [] })`. No object literal rebuilt per spec, no shared mutable `beforeEach` state. | §1 |

## Unknown elements and the child-import rule

The test setup turns on `errorOnUnknownElements` and `errorOnUnknownProperties` (`setupZoneTestEnv({ errorOnUnknownElements: true, errorOnUnknownProperties: true })` in each lib's `test-setup.ts`). An unknown `acme-…` tag or an unknown bound property then fails the spec instead of rendering nothing.

Consequence: a standalone component under test must list every child component, directive and pipe its template uses in its own `imports`. A spec that fails with "is not a known element" is a bug in the component, not in the spec: fix the component's `imports`, never `schemas: [NO_ERRORS_SCHEMA]`. A child that is heavy (a map, a chart, a data grid) is swapped with `overrideComponents` for a stub carrying the same selector and inputs (recipes §4).

## Async: rxMethod, resource, effects

| Under test | How it settles | Recipe |
|---|---|---|
| `rxMethod` called with a plain value | Runs synchronously. Stub the API with `of(value)` and assert right after the call. | §6 |
| `rxMethod` called with a signal | Subscribes through an effect: change the signal, then `TestBed.tick()`. | §6 |
| The loading phase in between | Stub the API with a `Subject`; call, assert `loading`, then `subject.next(value)` and assert `loaded`. | §6 |
| An error path | `throwError(() => new HttpErrorResponse({ status: 500 }))`; assert the store's error state, and that the method still works on the next call. | §6 |
| `resource()` / `httpResource()` | Set the params signal, `TestBed.tick()`, then `await TestBed.inject(ApplicationRef).whenStable()`; the loader is a pending task, so `whenStable` waits for it. Assert `status()`, then `value()` only behind `hasValue()`. | §7 |
| An `effect()` | `TestBed.tick()` (Angular 20+) runs pending effects; `TestBed.flushEffects()` is the deprecated name. In a component spec, `spectator.detectChanges()` does the same. | §6 |
| `debounceTime`, `setTimeout` | `jest.useFakeTimers()`, `jest.advanceTimersByTime(300)`; restore in `afterEach`. | §9 |
| HTTP at the boundary | `provideHttpClient()`, `provideHttpClientTesting()`, `HttpTestingController.expectOne(url).flush(body)`, `verify()` in `afterEach`. | §8 |

## What not to mock

| Never mock | Why |
|---|---|
| Pure utils and pipes | They are the logic; a mocked `formatMoney` proves nothing. |
| The store or service under test | Test it through its public methods and signals. |
| Fixtures and models | Use the fixture function; a `{} as Order` cast hides a missing field. |
| A light child component | Import it; the template contract is part of the behaviour. |

Mock only the edge: the API service or `HttpTestingController`, persistence tokens, the dialog service (a spy returning the closed result), `Router.navigate` (a spy over `provideRouter([])`), browser APIs the test environment lacks. The dialog and the navigation: recipes §10.

## Jest 30

The alias matchers are gone: write `toHaveBeenCalled`, `toHaveBeenCalledWith`, `toThrow`, never `toBeCalled`, `lastCalledWith`, `toThrowError`. One file: `npx nx test <project> --testFile <path>`; a task: the rules file's `verify`.

## Before you report a task done

- Every changed behaviour has an `it` that fails without the change.
- No `NO_ERRORS_SCHEMA`, `CUSTOM_ELEMENTS_SCHEMA` or `as any` in a spec; no Arrange/Act/Assert comments.

## Common mistakes

- Writing to an input instead of `setInput`.
- A spec that passes because a mocked util returns the expected value.
- Asserting a resource's `value()` before awaiting `whenStable`.
- One `it('works')` covering four behaviours.
