# tether-nx

A Claude Code plugin of agents and skills for Angular and Nx workspaces: one app, per-domain libraries under `libs/<scope>/<name>`, route-scoped providers, and signals over RxJS. The plugin ships Markdown only, with no hooks and no scripts.

> **Status: 0.1.0, early.** The rules and agents are extracted from a production Angular/Nx workspace, but the plugin agents have not yet been verified on other repositories. Rule ids are stable; wording may change. Please open an issue when an agent or rule does not fit your workspace.

## What it is

Opinionated defaults the user can override. Every rule has a stable id (`NX-1`, `SIG-2` and so on), and the agents plan, implement and review against those ids. A project that works differently says so in its own `.claude/tether-nx.md`, and every agent and skill reads that file first:

> Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

A project without the file gets the defaults.

Version 0.1 has no issue-tracker agent and no pull-request agent. The agents start from a brief, a request or ticket text the user provides, or a symptom, and they stop at a commit.

## Install

From a local clone, run these from the project directory:

```
claude plugin marketplace add /path/to/tether
claude plugin install tether-nx@tether --scope local
```

From GitHub, pinned to a tag:

```
claude plugin marketplace add AndriiSiuta/tether#v0.2.0
claude plugin install tether-nx@tether --scope local
```

`--scope local` enables the plugin in `.claude/settings.local.json` for this project only. After a new tag, run `claude plugin marketplace update tether` and then `claude plugin update tether-nx@tether`, and start a new session.

## With tether

`tether-nx` works on its own. Installed beside the `tether` plugin from the same marketplace, it also gets tether's implementer report hook and fix-round cap. Both act only on the agent types listed in `implementerAgents` in the project's `.claude/harness.json`, so list the plugin's two implementers there:

```json
{
  "implementerAgents": ["tether-nx:implementer", "tether-nx:implementer-mechanical"],
  "reportFields": ["Files:", "Checks:", "Deferred:", "Plan edits:|Blocked:"]
}
```

The report hook then sends an implementer back when its final message lacks `Files:`, `Checks:`, `Deferred:` and `Plan edits:`, or a `Blocked:` line. The fix-round cap keys its count on the dispatch's first line, so an implementer dispatch starts with `# Task <N>: <title>`. To have tether's spec word cap watch the spec-writer, set `spec.agent` to `tether-nx:spec-writer` and `spec.dir` to the rules file's `paths.specs` (`docs/specs` by default), so the cap reads the folder the spec-writer writes to. See the `tether` README for the other keys.

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

## Agents

Dispatch an agent by its plugin name, `tether-nx:<agent>`.

| Agent | Job | Preloaded skills | How to dispatch |
|---|---|---|---|
| `investigator` | Read-only. Traces a brief, a ticket text or a symptom end to end (route → providers → component → service → model) and reports the touched files, the flow and the constraints. Never designs or edits. | `investigating-codebase` | Before a spec or a fix, when the touched files are not yet known. |
| `spec-writer` | Turns the request and an agreed approach into a feature spec under `paths.specs`, within a 1,500-word cap, and reports the path and the open decisions. Writes documents only. | `writing-feature-spec`, `drawing-architecture-diagrams`, `writing-adr` | After the brainstorm, with a brief that settles acceptance criteria, screens, copy, data contract and placement. |
| `planner` | Writes the implementation plan for an approved spec under `paths.plans`, one task per dispatchable unit, tagged `[impl]` or `[impl:mechanical]`. Never writes product code. | `angular-nx-conventions`, `typescript-style`, `angular-architecture` | With the spec path, after the spec is agreed. |
| `implementer` | Implements one `[impl]` task, adds a co-located spec, runs the `verify` command, commits from a pathspec, and reports `Files:`, `Checks:`, `Deferred:`, `Plan edits:` or `Blocked:`. | `angular-nx-conventions`, `typescript-style` | With the task brief, starting `# Task <N>: <title>`. |
| `implementer-mechanical` | Same contract and report for an `[impl:mechanical]` task whose brief already carries the code or an exact copy rule. Stops with `Blocked:` on any open decision. | none | With the task brief, starting `# Task <N>: <title>`. |
| `reviewer` | Read-only review of a diff or commit. Returns one table with a verdict, never a narrative, and never edits. | `angular-nx-conventions`, `typescript-style` | The dispatch's first line names the mode, below. Any other first line gets `Blocked: name the mode`. |

The `reviewer` modes:

| First line | What it checks |
|---|---|
| `Mode: conventions` | The change against every rule id of `angular-nx-conventions` and the rules file, plus lint parity, dependencies and commit style. |
| `Mode: pairings` | The second file the diff forgot: the other language file, the flag getter, the action handler, the route guard, the column config a renamed field feeds. Convention rules are out of scope in this mode. |

The two modes do not overlap: dispatch the reviewer once per mode.

## Skills

Skills are referenced as `tether-nx:<skill>`.

| Skill | Use it for | Source |
|---|---|---|
| `angular-nx-conventions` | Placement, library types and tags, imports, providers, the signals contract, components, copy and tests; holds the rule ids and the rules-file keys. | original |
| `typescript-style` | TypeScript that states what it holds: view unions for loaded lists, absent values typed at the edge, typed column configs, pure sort and search. | original |
| `angular-architecture` | Where a file belongs and whether one part may import another: layers, provider scope, shared kit versus feature UI. | original |
| `investigating-codebase` | Understanding a change or a bug before it is planned or specced. | original |
| `writing-adr` | Recording a decision that spans more than one feature or reverses an earlier one. | original |
| `drawing-architecture-diagrams` | Context, container, flow, sequence and entity-relationship diagrams for specs, ADRs and READMEs. | original |
| `writing-feature-spec` | Writing a converged design down before planning, with a feature template and a refactor template. | original |
| `ng-performance` | Slow loads, jank, change detection, `@defer`, bundle size, Core Web Vitals. | vendored, MIT |
| `ng-accessibility` | WCAG 2.2 AA, keyboard and screen-reader support, focus, contrast, reduced motion. | vendored, MIT |

The two vendored skills keep their upstream `LICENSE` files. Their sources, pinned commits, copyright holders and local modifications are listed in [`NOTICE`](NOTICE).

## Rule ids

The rule ids (`NX-*`, `FEAT-*`, `DI-*`, `SIG-*`, `CMP-*`, `COPY-1`, `TEST-1`, `TS-1`, `GUARD-*`) and what each one says are in the `angular-nx-conventions` skill, [`skills/angular-nx-conventions/SKILL.md`](skills/angular-nx-conventions/SKILL.md). The `GUARD-*` rules describe the checks a workspace should add so that the layout rules are enforced by tests and lint, not by review alone.

## Recommended

The Angular team's `angular-developer` skill, from [github.com/angular/skills](https://github.com/angular/skills), listed on [angular.dev/ai/agent-skills](https://angular.dev/ai/agent-skills). It covers the per-file Angular APIs (signals, `resource`, forms, routing, DI, testing) that this plugin's rules sit on top of. It is linked here, not copied.

## Evals

Five cases under [`evals/`](evals/), in Claude Code's `claude plugin eval` format (a `prompt.md`, an optional `case.yaml` and `graders/*.md` per case). Each case dispatches one agent against a small read-only fixture workspace in the case's `workspace/` folder, over a neutral orders and invoices domain, and grades the result mostly with free regex and tool checks:

| Case | Checks |
|---|---|
| `reviewer-flags-root-domain-service` | `Mode: conventions` marks `DI-2` fail for a data-access service with `providedIn: 'root'`. |
| `reviewer-flags-feature-import` | `Mode: conventions` marks `FEAT-3` fail for a feature library that imports another feature library. |
| `reviewer-without-mode-is-blocked` | A dispatch with no mode line gets `Blocked: name the mode` and no table. |
| `planner-task-headings` | The plan's tasks are headed `### Task <N>: [tag] <title>`, one tag each, at most 12. Needs `--allow-tools Write`. |
| `implementer-blocks-on-open-placement` | A brief that leaves placement open gets a `Blocked:` report and no written file. One `llm` grader. |

Every run is a real model call on your account. From the repository root, a cheap single pass with no baseline arm:

```
claude plugin eval plugins/tether-nx --ablation none --runs 1 --no-publish
```

Add `--tag smoke` for the four read-only cases, `--case <name>` for one case, and `--allow-tools Write` for the planner case. Drop `--ablation none --runs 1` for the default three runs with and without the plugin, which reports what the plugin adds. Results go to `evals/results/`, which is git-ignored. The first run asks you to trust the directory.

## Tests

From the repository root:

```
node --test 'plugins/*/test/**/*.test.mjs' 'test/**/*.test.mjs'
```

The neutrality test reads a git-ignored `.neutrality-denylist` at the repository root, one regular expression per line. Without that file, the denylist check is skipped with a visible note; the ticket-reference and npm-scope checks still run. Check the manifests with `claude plugin validate .` and `claude plugin validate plugins/tether-nx`.
