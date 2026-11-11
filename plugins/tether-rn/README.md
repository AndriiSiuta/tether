# tether-rn

A Claude Code plugin with the rules for a React Native app: where a file goes and what it may import, one transport identity, native capabilities behind wrappers, where state lives, what a route may carry, and what must never be in the bundle. It is skills only; the agents that apply the rules live in `tether-mobile`.

> **Status: 0.1.0, new.** The rules were written against one bare React Native app with React Navigation and Redux Toolkit, and checked against the React Navigation, Redux and React Native documentation. They have not yet been used through a full run. Expect wording changes; rule ids are stable.

## Install

From a local clone, run these from the project directory:

```
claude plugin marketplace add /path/to/tether
claude plugin install tether-rn@tether --scope local
```

`--scope local` enables the plugin in `.claude/settings.local.json` for this project only.

## The rules file

The file is `.claude/tether-rn.md` at the project root. Every skill starts with:

> Read `.claude/tether-rn.md` first; where it differs from this file, it wins.

A template:

```markdown
# Project rules (tether-rn)
layout: { app: src/app, core: src/core, shared: src/shared, features: src/features }
alias: @org/
state: Redux Toolkit slices, one file per feature
navigation: React Navigation 7, dynamic API
i18n: none
verify: npm run verify -- --base {base}
paths: { specs: docs/specs, plans: docs/plans, reports: docs/reports }
overrides:
- CMP-2: Styles live in a sibling `styles.ts`.
facts:
- The orders API returns amounts in minor units.
```

| Key | Meaning | Default without the file or the key |
|---|---|---|
| `layout` | The folder each layer lives in. An app that is not laid out as `app/ core/ shared/ features/` maps its real folders here; the rules then apply to those folders. | `src/app`, `src/core`, `src/shared`, `src/features` |
| `alias` | The import prefix that maps to the source root. | `@org/` |
| `state` | The state approach for new code. | Redux Toolkit slices, one file per feature |
| `navigation` | The navigation library and the API style in use. | React Navigation, the style the app already uses |
| `i18n` | The translation library and the language files. | none; `COPY-1` is then `n/a` |
| `verify` | The one command that proves a task; `{base}` is replaced with the task's base commit. | `npx tsc --noEmit && npx eslint . && npx jest --changedSince={base}` |
| `paths` | `specs`, `plans` and `reports`. | `docs/specs`, `docs/plans`, `docs/reports` |
| `overrides` | `- <rule id>: <the project's rule>` lines; each replaces that rule. | none |
| `facts` | Lines every agent treats as true for this project. | none |

A `verify` command should print one fixed line when it passes, such as `verify: ok`, so the `tether` report hook can require it (`checksPassLine`).

## Skills

Skills are referenced as `tether-rn:<skill>`.

| Skill | Use it for |
|---|---|
| `react-native-conventions` | The rule ids: layers (`LAY`), network (`NET`), device (`DEV`), state (`STATE`), navigation (`NAV`), components (`CMP`), config (`CFG`), logging (`LOG`), copy (`COPY`), native projects (`NAT`), tests (`TEST`), TypeScript (`TS`) and the guards (`GUARD`). |
| `react-native-architecture` | The reasoning behind the placement rules: the import test, one transport identity, why core does not talk to the user, state placement, navigation boundaries, and a repository that is not laid out this way. |
| `typescript-style` | TypeScript in a React Native app: view unions, absence at the edge, typed route params and network data, styles that depend on state. |

No skill is vendored, so the plugin carries no third-party licence files. Performance and navigator UI are left to whatever skills the project installs for them.

## Rule ids

Ids are stable: an id never changes meaning and is never renumbered or reused. To change what a rule requires, add a new id and mark the old one deprecated in the table. A project that disagrees with a rule overrides it in `.claude/tether-rn.md`; it does not edit the plugin.

## Tests

From the repository root:

```
node --test 'plugins/*/test/**/*.test.mjs' 'test/**/*.test.mjs'
```

The frontmatter test checks that every `tether-rn` skill names itself after its folder, that its reference links resolve, and that it carries the sentence ``Read `.claude/tether-rn.md` first; where it differs from this file, it wins.`` exactly once. Check the manifest with `claude plugin validate plugins/tether-rn`.
