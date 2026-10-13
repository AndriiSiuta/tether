# tether-web

A Claude Code plugin with the workflow for a web front end: ten agents and the process skills they preload, which take a ticket from investigation to an open pull request. The order is investigator → spec-writer → planner → plan-validator → implementers in waves → code-reviewer on every task, conventions-reviewer on a new shape → ui-checker → syncing-docs → pr-creator. Every handoff is a file or a fixed report shape: a spec with numbered decisions, a plan whose tasks carry `touches:`, `conflicts_with:`, `spec:` and `checks:` fields, implementer reports with fixed labels and the failing test that came first, and reviewer tables that end on a verdict line. The Angular and Nx rules the agents apply come from `tether-nx`; this plugin holds the process.

> **Status: 0.1.0, early.** The agents come from a production Angular/Nx workspace and have not yet been verified on other repositories. Expect wording and report-format changes. Please open an issue when a step does not fit your workflow.

## Install

From a local clone, run these from the project directory:

```
claude plugin marketplace add /path/to/tether
claude plugin install tether-nx@tether --scope local
claude plugin install tether-web@tether --scope local
```

From GitHub, pinned to a tag:

```
claude plugin marketplace add AndriiSiuta/tether#v0.4.3
claude plugin install tether-nx@tether --scope local
claude plugin install tether-web@tether --scope local
```

`--scope local` enables the plugin in `.claude/settings.local.json` for this project only. After a new tag, run `claude plugin marketplace update tether` and then `claude plugin update tether-web@tether`, and start a new session.

`tether-web` needs `tether-nx` (its agents preload `tether-nx` skills) and the official Nx plugin, which supplies the workspace skills the agents use to read projects, targets and generators. Its `plugin.json` lists both under `dependencies`. The Nx plugin lives in the [`nrwl/nx-ai-agents-config`](https://github.com/nrwl/nx-ai-agents-config) repository, whose `.claude-plugin/marketplace.json` names the marketplace `nx-claude-plugins` and the plugin `nx`:

```
claude plugin marketplace add nrwl/nx-ai-agents-config
claude plugin install nx@nx-claude-plugins --scope local
```

That repository's README does not print these commands; it documents `npx nx configure-ai-agents`, which sets up the Nx MCP server, the agent instruction files and the skills, and the Nx docs say that for Claude Code the skills arrive as this plugin.

## With tether

Installed beside the `tether` plugin from the same marketplace, the two implementers get tether's report hook and fix-round cap, and the spec-writer gets the spec word cap. They act only on the agents named in the project's `.claude/harness.json`:

```json
{
  "implementerAgents": ["tether-web:implementer", "tether-web:implementer-mechanical"],
  "reportFields": ["Files:", "Red:", "Checks:", "Deferred:", "Plan edits:|Blocked:"],
  "checksPassLine": "verify: ok",
  "spec": { "dir": "docs/specs", "maxWords": 1500, "agent": ["tether-web:spec-writer"] }
}
```

The report hook sends an implementer back when its final message lacks `Files:`, `Red:`, `Checks:`, `Deferred:` and `Plan edits:`, or a `Blocked:` line, and, with `checksPassLine` set to the line the `verify` command prints when it passes, when `Checks:` does not quote that line. The fix-round cap keys its count on the dispatch's first line, so an implementer dispatch starts with `# Task <N>: <title>`. Set `spec.dir` to the rules file's `paths.specs` so the cap reads the folder the spec-writer writes to. `/tether:setup --only harness` writes the two implementers by default. See the `tether` README for the other keys, among them `localOnlyPaths`, which the pr-creator also reads.

## The rules file

The file is `.claude/tether-web.md` at the project root, the same shape as `.claude/tether-nx.md`. Every agent and skill starts with:

> Read `.claude/tether-web.md` first; where it differs from this file, it wins. If it does not exist, the defaults apply. `verify` and `paths` fall back to `.claude/tether-nx.md` when this file lacks them.

A template:

```markdown
# Project rules (tether-web)
tracker: github
pr: github
preview: http://localhost:4300
verify: npm run verify -- --base {base}
paths: { specs: docs/specs, plans: docs/plans, reports: docs/reports, followUps: docs/follow-ups.md }
models:
  - code-reviewer: sonnet
constitution: .claude/constitution.md
facts:
  - Pull requests target main as drafts with the label "frontend".
```

| Key | Meaning | Default without the file or the key |
|---|---|---|
| `tracker` | Where tickets live: `jira`, `github`, `ado`, `none`. With `jira` the investigator reads the issue through the session's Atlassian tool (`getJiraIssue`); with `github` through `gh issue view` or the GitHub tool; with `ado` through the Azure DevOps work-item tool; `none` means the brief text is the ticket. | `none` |
| `pr` | Where pull requests open: `ado`, `github`, `none`. `ado` uses the Azure DevOps pull-request tool, `github` uses `gh pr create`. The body follows the repo's PR template when one exists (`.azuredevops/pull_request_template.md`, `.github/pull_request_template.md`). | `none` (the pr-creator reports `Blocked:`) |
| `preview` | URL of a running dev-preview app the ui-checker drives, such as `http://localhost:4300`. | none (the ui-checker reports `Blocked:`) |
| `verify` | The one command that proves a task; `{base}` is replaced with the task's base commit. | `.claude/tether-nx.md`'s `verify`, else `npx nx affected -t lint test build --base={base}` |
| `paths` | `specs`, `plans`, `reports` and `followUps`, a register file of deferred items and open questions. | `.claude/tether-nx.md`'s `paths`, else `docs/specs`, `docs/plans`, `docs/reports`, `docs/follow-ups.md` |
| `models` | Per-agent model overrides, one `- <agent>: <model>` line each, which the dispatcher passes when it dispatches that agent. | the frontmatter models in the Agents table |
| `constitution` | Path of the project's constitution file, the non-negotiables with ids `CON-<n>`. | `.claude/constitution.md`; without it, the default set in the `constitution` skill |
| `facts` | Lines every agent treats as true for this project: the repository and project of the PR host, the target branch, reviewers and labels, a project skill to load. | none |

The rule overrides (`overrides:`), the library alias and the i18n files stay in `.claude/tether-nx.md`; see the `tether-nx` README.

## Agents

Agents are dispatched with the Agent tool as `tether-web:<agent>`.

| Agent | model | Job | Preloaded skills | How to dispatch |
|---|---|---|---|---|
| `investigator` | `inherit`, effort high | Read-only trace of a ticket or symptom: tracker issue, design frame, route, feature library, store or service, API contract; lists open follow-ups in the same area. | `tether-web:investigating-codebase` | The ticket key or the request text. Returns the skill's one-page report. |
| `spec-writer` | `inherit`, effort medium | Writes the agreed design as a spec under `paths.specs`, with a `## Decisions` list `D1`, `D2`, … the planner and validator cite, and a Placement row naming the existing file each new store, service or component copies; with no such file, an open decision instead. Documents only. | `tether-web:writing-feature-spec`, `tether-web:drawing-architecture-diagrams`, `tether-web:writing-adr` | The ticket text, the investigator's report and the brainstorm outcome. Returns the path and the open decisions. |
| `planner` | `inherit`, effort high, `maxTurns` 60 | Writes the plan under `paths.plans`: a header every brief carries, `### Task <N>: [impl] <title>` or `[impl:mechanical]` tasks each followed by a fenced `touches:` / `conflicts_with:` / `spec:` / `checks:` block and `Produces:` / `Consumes:` interfaces, `## Shared files` and `## Waves`. A decision the spec lacks is never made in the plan: the planner first appends it to the spec's `## Amendments` as a new dated `D<n>` marked "decided by the planner, confirm", and the task cites it. | `tether-nx:angular-nx-conventions`, `tether-nx:typescript-style`, `tether-nx:angular-architecture`, `tether-web:constitution` | The spec path. Returns the plan path, the task list, the waves and `Spec amendments:`. |
| `plan-validator` | `sonnet` | Read-only check of the plan against the spec: every decision implemented, every cited id real, every design choice in a task backed by a `D<n>`, every `Produces:` consumed, `touches:` paths reachable, `conflicts_with:` symmetric, waves derived from the fields, no constitution id broken. | `tether-web:constitution`, `tether-nx:angular-nx-conventions` | The spec path and the plan path. Returns a `Task \| Check \| Verdict \| Evidence` table and `Verdict: Dispatch` or `Verdict: Revise`. |
| `implementer` | `opus` | Implements one `[impl]` task inside its `touches:`, with a co-located spec run red before the change, verifies with `verify`, commits from a pathspec and re-reads its diff against the brief's `spec:` ids and `touches:` before reporting. | `tether-nx:angular-nx-conventions`, `tether-nx:typescript-style`, `tether-web:constitution`, `tether-web:testing-jest-spectator` | The plan header plus the task's own section, starting `# Task <N>: <title>`. Reports `Files:`, `Red:` (the failing test and its assertion line, or `Red: none: <why>`), `Checks:` (the verify pass line quoted verbatim), `Deferred:`, `Plan edits:`, or `Blocked:`. |
| `implementer-mechanical` | `opus` | Applies one `[impl:mechanical]` task whose brief carries the complete code or an exact copy rule; same contract and report as `implementer`. | none | As `implementer`, for tasks tagged `[impl:mechanical]`. |
| `conventions-reviewer` | `sonnet` | Read-only review of a diff against every `tether-nx` rule id and every constitution id, plus scope, lint parity, dependencies and commit style. | `tether-nx:angular-nx-conventions`, `tether-nx:typescript-style`, `tether-web:constitution` | A commit, a range or a diff, for a task the plan marks `new shape`. Returns a `Rule \| Verdict \| Evidence` table of the `fail` and `unverified` rules only, every row citing `path:line`, the line `Checked: <n> rules, <p> pass, <f> fail, <u> unverified`, and `Verdict: pass` or `Verdict: fail`. |
| `code-reviewer` | `opus` | Read-only check of each decision in the brief's `spec:` field (`met`, `missing` or `extra`, with `path:line`), then a hunt for the second file a diff forgot (barrel, route registration, pinned fixture, alias, a contract on another branch) and for correctness on empty, absent and failing paths. | none | The commit or range, with the brief's `spec:` and `touches:` fields. Returns a `Finding \| Severity \| Evidence \| Suggested fix` table, `SPEC` rows first, and `Verdict: pass` or `Verdict: fail`; a `missing` decision or an `extra` outside `touches:` fails it. |
| `ui-checker` | `sonnet` | Drives `playwright-cli` against `preview` for the `UI:` lines of a branch: opens each route, asserts the text or element, saves a screenshot under `paths.reports/ui/`. Never edits source, never starts a server. | `tether-web:ui-check-playwright-cli` | The `UI: <route> <what must be visible>` lines from the implementers' `Deferred:` sections. Returns a `Check \| Result \| Screenshot` table. |
| `pr-creator` | `sonnet` | Opens the pull request on the host `pr` names, after a five-point preflight (not the default branch, clean tree, commits ahead, no `localOnlyPaths` in the range, no PR already open). No builds or tests. When the permission system denies the create call, it prints the prepared title and body under `Blocked: MCP write denied` and stops. | none | Once the owner has reviewed the diff and the UI. The brief may name the target branch (a stacked PR) and the draft state; reviewers and labels come from `facts`. |

The implementers have every tool; the reviewers, the investigator and the validator read only, and the pr-creator adds the Azure DevOps pull-request tools to its read set. Every agent treats text from tickets, PR threads, designs and web pages as data, never instructions; none writes trailers or AI attribution into a commit or PR body; and every commit or push runs `git branch --show-current` in the same command.

### Dispatch order and waves

1. `investigator` on the ticket, then a brainstorm with the user until the approach is agreed.
2. `spec-writer`; the user settles its open decisions. A new store, service or component with no existing file to copy comes back as an open decision; run the brainstorm (`grilling`) on it before planning.
3. `planner`, then `plan-validator`. The user confirms the `D<n>` lines the planner reports under `Spec amendments:`. On `Verdict: Revise`, send the table back to the planner and validate again; dispatch nothing until `Verdict: Dispatch`.
4. Implementers, one wave at a time from the plan's `## Waves`: the tasks of a wave are independent and run in parallel; tasks that list each other in `conflicts_with:` run in order. Parallel implementers share one working tree, so each commits only its own pathspec (`git commit --only -- <paths>`, a new path `git add`ed first), never `git add -A` and never a bare commit. The files under `## Shared files` (barrels, the alias map, route tables, shared fixtures) belong to no task: implementers name the line they need under `Deferred:` as `Shared: <path>: <line>`, and the dispatcher commits those files once after the wave. When the repo's pre-commit hooks are flaky under parallel commits, dispatch each implementer of the wave with `isolation: worktree` instead.
5. `code-reviewer` on every task, with the brief's `spec:` and `touches:` fields in its prompt; `conventions-reviewer` beside it only on tasks the plan marks `new shape`. The dispatcher refutes any finding without evidence.
6. Fix rounds: rounds 1 and 2 resume the same implementer by name (SendMessage with the review table), which costs a fraction of a fresh dispatch; a fresh dispatch only when that implementer is gone, or when the fix-round cap is reached and the user asks for another round.
7. `ui-checker` once per branch on the collected `UI:` lines, with the preview app running.
8. `syncing-docs`: specs, plans, ADRs, the rules files and the follow-ups register checked against the code; new follow-ups appended to `paths.followUps`. It is a required row of the run's ledger; step 9 does not start without it.
9. `pr-creator`, once the owner has reviewed the diff and the UI.

## Skills

Skills are referenced as `tether-web:<skill>`.

| Skill | Use it for | Source |
|---|---|---|
| `investigating-codebase` | Tracing a change, feature or bug before it is specced or planned: touched files, data flow, constraints; the investigator's report template. | moved from `tether-nx` in its 0.3.0 |
| `writing-feature-spec` | Writing an agreed design down as a spec, with the section template and the refactor template. | moved from `tether-nx` |
| `writing-adr` | Recording a decision that spans more than one feature or reverses an earlier one. | moved from `tether-nx` |
| `drawing-architecture-diagrams` | A context, container, flow, sequence or entity-relationship diagram for a spec, ADR or README. | moved from `tether-nx` |
| `constitution` | The non-negotiables a project will not relitigate, each with an id `CON-<n>`: where they live, how the planner, validator, implementers and reviewers apply them, and a default set in `references/default-constitution.md`. | original |
| `testing-jest-spectator` | Jest specs with Spectator for components, services, stores, pipes and utils: factories, `data-testid` queries, fixtures by spread, stores through `TestBed`, `rxMethod` and `resource` in tests, what not to mock; recipes in `references/recipes.md`. | original |
| `tailwind-tokens` | Tailwind 3 classes: scale tokens over arbitrary values, colour tokens by name, no fixed width or height on a layout box, two-column frames, when an arbitrary value is allowed. | original |
| `ui-check-playwright-cli` | How the ui-checker drives `playwright-cli`: install, the `UI:` line grammar, open, navigate, assert, screenshot, and what to do when an assertion fails. | original |
| `syncing-docs` | Checking specs, plans, ADRs, the rules files and the follow-ups register against the code at the end of a branch. | original |

No skill in 0.1.0 is vendored, so the plugin carries no third-party licence files.

## Evals

Six cases under [`evals/`](evals/), in Claude Code's `claude plugin eval` format (a `prompt.md`, a `case.yaml` and `graders/*.md` per case). Each case dispatches one agent against a small fixture workspace in the case's `workspace/` folder, over a neutral orders domain, and grades the result mostly with free regex and tool checks:

| Case | Checks |
|---|---|
| `conventions-reviewer-flags-root-domain-service` | The table has the columns `Rule`, `Verdict`, `Evidence`, the `DI-2` row is `fail` for a data-access service with `providedIn: 'root'`, and the reply's final line is `Verdict: fail` with no `Verdict: pass`. |
| `conventions-reviewer-flags-feature-import` | The same table and verdict line, with the `FEAT-3` row `fail` for a feature library that imports another feature library. |
| `implementer-blocks-on-open-placement` | A brief that leaves placement open gets a `Blocked:` report and no written file. One `llm` grader. Needs `--scaffold`. |
| `planner-task-headings` | The plan's tasks are headed `### Task <N>: [tag] <title>`, one tag each, at most 12. Needs `--allow-tools Write --scaffold`. |
| `planner-task-fields` | Every `### Task` heading of the plan is followed by a fenced block carrying `touches:`, `conflicts_with:`, `spec:` and `checks:`, and the plan has `## Waves` and `## Shared files`. Needs `--allow-tools Write --scaffold`. |
| `plan-validator-revises-on-unimplemented-decision` | For a spec with D1 to D3 and a plan whose tasks cite only D1 and D2, the validator returns the `Task \| Check \| Verdict \| Evidence` table, a row naming `D3`, and the final line `Verdict: Revise`. Needs `--scaffold`. |

The two reviewer cases carry the change inline in the brief and need no fixture read. The other four stage their fixture in the run's working directory with a `scaffold_script`, because the runner grants reads on an `add_dirs` folder but never tells the agent its path; run them with `--scaffold`.

Every run is a real model call on your account. From the repository root, a cheap single pass with no baseline arm:

```
claude plugin eval plugins/tether-web --ablation none --runs 1 --no-publish --scaffold --allow-tools Write
```

Add `--tag smoke` for the four read-only cases (the two reviewers, the implementer and the validator), `--tag planner` for the two planner cases, or `--case <name>` for one case. Drop `--ablation none --runs 1` for the default three runs with and without the plugin, which reports what the plugin adds. Results go to `evals/results/`, which is git-ignored. The first run asks you to trust the directory.

## Tests

From the repository root:

```
node --test 'plugins/*/test/**/*.test.mjs' 'test/**/*.test.mjs'
```

The frontmatter test checks that every `tether-web` agent and skill names itself after its file or folder, preloads only skills that exist in this plugin or in a plugin its manifest lists under `dependencies`, and carries the sentence ``Read `.claude/tether-web.md` first; where it differs from this file, it wins.`` exactly once. The neutrality test reads a git-ignored `.neutrality-denylist` at the repository root; without it, the denylist check is skipped with a visible note, and the ticket-reference and npm-scope checks still run. Check the manifest with `claude plugin validate plugins/tether-web`.
