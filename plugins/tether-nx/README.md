# tether-nx

A Claude Code plugin of rules for Angular and Nx workspaces: one app, per-domain libraries under `libs/<scope>/<name>`, route-scoped providers, signals over RxJS, SignalStore and PrimeNG usage, performance and accessibility. It ships skills only, as Markdown, with no agents, hooks or scripts. The agents that plan, implement and review against these rules live in the `tether-web` plugin from the same marketplace.

> **Status: 0.3.1, early.** The rules are extracted from a production Angular/Nx workspace and have not yet been verified on other repositories. Rule ids are stable; wording may change. 0.3.0 moved the agents, the evals and four process skills to `tether-web`. Please open an issue when a rule does not fit your workspace.

## What it is

Opinionated defaults the user can override. Every rule has a stable id (`NX-1`, `SIG-2` and so on), and the `tether-web` agents plan, implement and review against those ids. A project that works differently says so in its own `.claude/tether-nx.md`, and every skill reads that file first:

> Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

A project without the file gets the defaults.

## Install

From a local clone, run these from the project directory:

```
claude plugin marketplace add /path/to/tether
claude plugin install tether-nx@tether --scope local
```

Add `claude plugin install tether-web@tether --scope local` for the agents.

From GitHub, pinned to a tag:

```
claude plugin marketplace add AndriiSiuta/tether#v0.4.4
claude plugin install tether-nx@tether --scope local
```

`--scope local` enables the plugin in `.claude/settings.local.json` for this project only. After a new tag, run `claude plugin marketplace update tether` and then `claude plugin update tether-nx@tether`, and start a new session.

## With tether

`tether-nx` works on its own as a set of skills. The agents that use them come from `tether-web`; installed beside the `tether` plugin from the same marketplace, those agents also get tether's implementer report hook and fix-round cap. Both act only on the agent types listed in `implementerAgents` in the project's `.claude/harness.json`, so list the two `tether-web` implementers there:

```json
{
  "implementerAgents": ["tether-web:implementer", "tether-web:implementer-mechanical"],
  "reportFields": ["Files:", "Checks:", "Deferred:", "Plan edits:|Blocked:"]
}
```

The report hook then sends an implementer back when its final message lacks `Files:`, `Checks:`, `Deferred:` and `Plan edits:`, or a `Blocked:` line. The fix-round cap keys its count on the dispatch's first line, so an implementer dispatch starts with `# Task <N>: <title>`. To have tether's spec word cap watch the spec-writer, set `spec.agent` to `tether-web:spec-writer` and `spec.dir` to the rules file's `paths.specs` (`docs/specs` by default), so the cap reads the folder the spec-writer writes to. See the `tether` README for the other keys.

## The rules file

The file is `.claude/tether-nx.md` at the project root. A template:

```markdown
# Project rules (tether-nx)
alias: @org/
ui: Angular Material
state: NgRx SignalStore in data-access libraries
i18n: ngx-translate; every key in each file under apps/<app>/src/assets/i18n/
verify: npm run verify -- --base {base}
paths: { specs: docs/specs, plans: docs/plans, reports: docs/reports }
overrides:
  - <rule id>: <the project's rule>
facts:
  - <anything the agents must know>
```

| Key | Meaning | Default without the file or the key |
|---|---|---|
| `alias` | The import prefix of the workspace's libraries, so a library is `<alias><scope>/<name>`. | `@org/` |
| `ui` | The component library new screens use. | Angular Material |
| `state` | The state approach for new code. | signal services (`SIG-4`) |
| `i18n` | The translation library and the language files every user-visible key must be present in. | the ngx-translate pipe; every file under `assets/i18n/` |
| `verify` | The one command that proves a task. `{base}` is replaced with the task's base commit. | `npx nx affected -t lint test build --base={base}` |
| `paths` | Where the spec-writer writes specs, the planner writes plans, and run reports go. | `docs/specs`, `docs/plans`, `docs/reports` |
| `overrides` | One `- <rule id>: <the project's rule>` line per rule the project replaces. A rule the file does not name keeps its default; a rule that does not fit is overridden, never silently ignored. | none |
| `facts` | Lines every agent treats as true for this project, such as a project skill to load or a unit an API returns. | none |

For example, ``- CMP-1: The selector prefix is `acme-`.`` changes the selector rule, and `- The orders API returns amounts in minor units.` under `facts:` binds every agent.

## Agents and evals

The agents (investigator, spec-writer, planner, implementers, reviewers and the rest) and their eval cases moved to the `tether-web` plugin in 0.3.0. See its README for how to dispatch them and run the evals; they read this plugin's rules file and skills.

## Skills

Skills are referenced as `tether-nx:<skill>`.

| Skill | Use it for | Source |
|---|---|---|
| `angular-nx-conventions` | Placement, library types and tags, imports, providers, the signals contract, components, copy and tests; holds the rule ids and the rules-file keys. | original |
| `typescript-style` | TypeScript that states what it holds: view unions for loaded lists, absent values typed at the edge, typed column configs, pure sort and search. | original |
| `angular-architecture` | Where a file belongs and whether one part may import another: layers, provider scope, shared kit versus feature UI. | original |
| `ng-performance` | Slow loads, jank, change detection, `@defer`, bundle size, Core Web Vitals. | vendored, MIT |
| `ng-accessibility` | WCAG 2.2 AA, keyboard and screen-reader support, focus, contrast, reduced motion. | vendored, MIT |
| `ng-signalstore` | NgRx SignalStore state: shared and derived state, entities, `rxMethod`, and the async shape of a store request (`tapResponse`, call state, no Observable-returning methods). | vendored, MIT, archived upstream |
| `ng-primeng` | PrimeNG components: standalone imports, lazy and virtual-scroll tables, the Aura and Lara presets with design tokens. | vendored, MIT, archived upstream |

The process skills `investigating-codebase`, `writing-feature-spec`, `writing-adr` and `drawing-architecture-diagrams` moved to `tether-web` in 0.3.0 and are referenced as `tether-web:<skill>`.

The four vendored skills keep their upstream `LICENSE` files. Their sources, pinned commits or versions, copyright holders and local modifications are listed in [`NOTICE`](NOTICE).

## Rule ids

The rule ids (`NX-*`, `FEAT-*`, `DI-*`, `SIG-*`, `CMP-*`, `COPY-1`, `TEST-1`, `TS-1`, `GUARD-*`) and what each one says are in the `angular-nx-conventions` skill, [`skills/angular-nx-conventions/SKILL.md`](skills/angular-nx-conventions/SKILL.md). The `GUARD-*` rules describe the checks a workspace should add so that the layout rules are enforced by tests and lint, not by review alone.

## Recommended

The Angular team's `angular-developer` skill, from [github.com/angular/skills](https://github.com/angular/skills), listed on [angular.dev/ai/agent-skills](https://angular.dev/ai/agent-skills). It covers the per-file Angular APIs (signals, `resource`, forms, routing, DI, testing) that this plugin's rules sit on top of. It is linked here, not copied.

## Tests

From the repository root:

```
node --test 'plugins/*/test/**/*.test.mjs' 'test/**/*.test.mjs'
```

The neutrality test reads a git-ignored `.neutrality-denylist` at the repository root, one regular expression per line. Without that file, the denylist check is skipped with a visible note; the ticket-reference and npm-scope checks still run. Check the manifests with `claude plugin validate .` and `claude plugin validate plugins/tether-nx`.
