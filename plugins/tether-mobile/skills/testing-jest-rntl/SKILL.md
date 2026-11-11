---
name: testing-jest-rntl
description: Use when writing or reviewing a Jest test for a React Native component, screen, hook, slice, api function or util with React Native Testing Library — a new behaviour that needs its test, a test failing on a native module import, an element that cannot be found, an act warning, a navigation or store dependency in a screen, a mock that hides the code under test.
---

# Testing with Jest and React Native Testing Library

Read `.claude/tether-mobile.md` first; where it differs from this file, it wins.

## Overview

One test file beside the file it tests, one `it` per behaviour, each failing without its change (`CON-8`, `TEST-1`). The library renders the unit, fixtures build the data, and only the edge is replaced: the api module, native modules, the clock. Queries and `userEvent` come from `@testing-library/react-native`; follow the API of the version the project has installed, and copy the shape of a neighbouring test before writing a new one.

## The recipe

| Situation | Write |
|---|---|
| A presentational component | `render(<OrderCard order={orderItem()} onPress={onPress} />)`, then assert through `screen`. Props are the whole input. |
| Finding an element | By what the user perceives, in this order: `getByRole('button', { name: 'Cancel order' })`, `getByText`, `getByLabelText`; `getByTestId` only where nothing perceivable identifies it. Never a tree position, a component type or a style. |
| A user action | `const user = userEvent.setup()`, then `await user.press(...)`, `await user.type(...)`. `fireEvent` only for an event `userEvent` does not model (a scroll, a layout). |
| Something that appears later | `await screen.findByText('No orders yet')`. Never a fixed `setTimeout` or a bare `await Promise.resolve()`. |
| Something that must be absent | `expect(screen.queryByText('Retry')).toBeNull()`, after the state that removes it has settled. |
| A connected component or screen | A `renderWithStore(ui, { preloadedState })` helper, written once in the test utilities, that builds the real root reducer into a fresh store per test. The store is real; the feature's api module is `jest.mock`ed. Never a mocked `useSelector`. |
| A screen that navigates | Pass a `navigation` object whose methods are `jest.fn()` and a `route` with the params under test, and assert `navigate` was called with the route name and the id. A real `NavigationContainer` only when the test is about the navigator itself. |
| A slice | Call the reducer with a state and an action and assert the next state; a thunk through a real store with the api module mocked, asserting the state after `await store.dispatch(...)`. |
| A selector or util | A plain function call. One case per state kind of a view union, including empty and error. |
| An api function | The HTTP client module mocked at its boundary; assert the request it builds and the model it returns from a DTO fixture. |
| A hook | `renderHook(() => useOrderExport(orderId))`, then act through `result.current` and assert its returned state. |
| Data | A fixture function per model, `orderItem(overrides)`, overridden by spread: `orderItem({ lines: [] })`. No object literal rebuilt per test, no shared mutable `beforeEach` state. |
| Time | `jest.useFakeTimers()` and `jest.advanceTimersByTime(...)`, with `userEvent.setup({ advanceTimers: jest.advanceTimersByTime })`; restore real timers in `afterEach`. |

## Native modules

A module with native code fails at import under Jest: `Cannot use import statement outside a module`, or a `null` native module. Both are setup problems, never a reason to skip the test.

| Symptom | Fix |
|---|---|
| A syntax error from a file under `node_modules` | The package ships untranspiled source: add it to the `transformIgnorePatterns` exception list in the Jest config. This is a test-config change, so ask first. |
| `null is not an object` or `undefined is not a function` on a native module | A mock in the Jest setup file, or a file under `__mocks__/` at the project root, using the mock the library publishes when it has one. One mock for the whole project, not one per test. |
| A value from build-time configuration | A root `__mocks__` file for the config module with fixed test values; never a real key. |

A test mocks a native capability at its `core` wrapper (`DEV-1`), not at the native module, whenever the unit under test is above the wrapper.

## What not to mock

- The unit under test, or the selector, reducer or hook it exists to exercise.
- The store: use the real one with preloaded state.
- A child component, unless it pulls native code (a map, a video player); then stub it with a component that renders its `testID` and the props the test asserts.
- What the global setup already mocks.

## Common mistakes

- An `act` warning silenced by wrapping everything in `act`: the test asserted before an update settled; `await` a `findBy` query or the user action instead.
- `getByTestId` on an element that has a visible label or role.
- A snapshot of a whole screen as the only assertion: it pins markup and proves no behaviour.
- A test that renders a screen and asserts only that it did not throw.
- A passing test that mocks the api module to return exactly what the assertion checks, with no code in between.
- A fixture edited to make an old test pass after the behaviour changed, instead of the test.
- A new native mock written inline in one test file while the same module is imported by ten others.
