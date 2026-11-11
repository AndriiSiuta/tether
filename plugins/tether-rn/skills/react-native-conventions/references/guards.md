# Guards

A guard is an automated check that fails when a rule is broken. Where the app lacks one, the rule is "review" until a task adds it. A guard is added by its own task, never folded into a feature change.

## GUARD-1: boundary lint

Enforces `LAY-1`, `LAY-3`, `LAY-5` and `NET-1`. It fails on:

- a file under `shared/` or `core/` importing from `features/`;
- a file under `features/a/` importing from `features/b/` outside `features/b/public/`;
- a file under `shared/` importing the store hooks, a query hook, `useNavigation` or any `api.ts`;
- a file outside `core/` and the features' `api.ts` importing the HTTP client or a transfer library.

With ESLint's built-in `no-restricted-imports`, scoped by `overrides`:

```js
module.exports = {
  overrides: [
    {
      files: ['src/shared/**', 'src/core/**'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{ group: ['**/features/**', '@org/features/**'], message: 'LAY-1: shared and core never import a feature.' }],
          paths: [
            { name: 'react-redux', message: 'LAY-5: a shared component takes props.' },
            { name: '@react-navigation/native', importNames: ['useNavigation', 'useRoute'], message: 'LAY-5: a shared component takes callbacks.' },
          ],
        }],
      },
    },
    {
      files: ['src/features/**'],
      excludedFiles: ['src/features/*/api.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          paths: [{ name: 'axios', message: 'NET-1: only api.ts calls the HTTP client.' }],
        }],
      },
    },
  ],
};
```

The cross-feature rule (`LAY-3`) needs a path pattern per feature, or a boundaries plugin that understands element types; either is acceptable. With a `layout` override, the globs name the project's real folders.

## GUARD-2: no-barrel lint

Enforces `LAY-4`. It fails on a file whose only statements are re-exports. A lint plugin for barrel files does this; without one, a test that walks the source tree and fails on an `index.ts` containing only `export … from` lines is enough.

## GUARD-3: secret scan

Enforces `CFG-2` as far as a scanner can: it fails on a credential-shaped literal in the tree or in history, and on a certificate, keystore or provisioning file being tracked. It runs on every pull request as a required check. It cannot tell that a value read from build-time configuration is secret; that part of `CFG-2` stays "review".
