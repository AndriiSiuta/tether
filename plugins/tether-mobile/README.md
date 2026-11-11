# tether-mobile

A Claude Code plugin with the workflow for a React Native app: nine agents and the process skills they preload, which take a ticket from investigation to an open pull request. The order is investigator → spec-writer → planner → plan-validator → implementers in waves → code-reviewer on every task, conventions-reviewer on a new shape → the owner's click-through on a device → syncing-docs → pr-creator. Every handoff is a file or a fixed report shape: a spec with numbered decisions, a plan whose tasks carry `touches:`, `conflicts_with:`, `spec:` and `checks:` fields, implementer reports with fixed labels and the failing test that came first, and reviewer tables that end on a verdict line. The React Native rules the agents apply come from `tether-rn`; this plugin holds the process.

> **Status: 0.1.0, new.** The process is the one `tether-web` uses, with the stack-specific agents rewritten for React Native. It has not yet been through a full run on a mobile repository. Expect wording and report-format changes. Please open an issue when a step does not fit your workflow.

## What differs from tether-web

- **No ui-checker.** A browser preview has no mobile equivalent that this plugin can drive without a simulator, a built app and a device-automation tool it does not bundle. Implementers write `UI:` lines as steps a person follows (`UI: <screen>, <how to reach it> shows <text>`), the planner collects them under `## Click-through`, and the owner runs them on a simulator or emulator before the pull request.
- **Native projects are fenced.** A change under `android/` or `ios/` is its own task (`NAT-1`); no agent runs a device build, starts the bundler or installs pods to prove a task.
- **Signing material and env files are never committed**, by either implementer, whatever the brief says.

## Install

From a local clone, run these from the project directory:

```
claude plugin marketplace add /path/to/tether
claude plugin install tether-rn@tether --scope local
claude plugin install tether-mobile@tether --scope local
```

`--scope local` enables the plugin in `.claude/settings.local.json` for this project only. After a change to the marketplace, run `claude plugin marketplace update tether` and then `claude plugin update tether-mobile@tether`, and start a new session.

`tether-mobile` needs `tether-rn` (its agents preload `tether-rn` skills), which its `plugin.json` lists under `dependencies`.

## With tether

Installed beside the `tether` plugin from the same marketplace, the two implementers get tether's report hook and fix-round cap, and the spec-writer gets the spec word cap. They act only on the agents named in the project's `.claude/harness.json`:

```json
{
  "implementerAgents": ["tether-mobile:implementer", "tether-mobile:implementer-mechanical"],
  "reportFields": ["Files:", "Red:", "Checks:", "Deferred:", "Plan edits:|Blocked:"],
  "checksPassLine": "verify: ok",
  "spec": { "dir": "docs/specs", "maxWords": 1500, "agent": ["tether-mobile:spec-writer"] }
}
```

The report hook sends an implementer back when its final message lacks `Files:`, `Red:`, `Checks:`, `Deferred:` and `Plan edits:`, or a `Blocked:` line, and, with `checksPassLine` set to the line the `verify` command prints when it passes, when `Checks:` does not quote that line. The fix-round cap keys its count on the dispatch's first line, so an implementer dispatch starts with `# Task <N>: <title>`. Set `spec.dir` to the rules file's `paths.specs`. See the `tether` README for the other keys, among them `localOnlyPaths`, which the pr-creator also reads; a mobile project lists its env files there.

## The verify command comes first

Every implementer ends by running the project's `verify` command and quoting the line it prints when it passes. A repository where the type-check, the lint or the test run does not pass today has no such line, and every implementer run ends `Blocked:`. Make `verify` pass on the default branch, and make it print one fixed line such as `verify: ok`, before the first dispatch.

## The rules file

The file is `.claude/tether-mobile.md` at the project root, the same shape as `.claude/tether-rn.md`. Every agent and skill starts with:

> Read `.claude/tether-mobile.md` first; where it differs from this file, it wins. If it does not exist, the defaults apply. `verify` and `paths` fall back to `.claude/tether-rn.md` when this file lacks them.

A template:

```markdown
# Project rules (tether-mobile)
tracker: jira
pr: ado
verify: npm run verify -- --base {base}
paths: { specs: docs/specs, plans: docs/plans, reports: docs/reports, followUps: docs/follow-ups.md }
models:
  - code-reviewer: sonnet
constitution: .claude/constitution.md
facts:
  - Pull requests target development.
```

| Key | Meaning | Default without the file or the key |
|---|---|---|
| `tracker` | Where tickets live: `jira`, `github`, `ado`, `none`. With `jira` the investigator reads the issue through the session's Atlassian tool; with `github` through `gh issue view` or the GitHub tool; with `ado` through the Azure DevOps work-item tool; `none` means the brief text is the ticket. | `none` |
| `pr` | Where pull requests open: `ado`, `github`, `none`. The body follows the repo's PR template when one exists. | `none` (the pr-creator reports `Blocked:`) |
| `verify` | The one command that proves a task; `{base}` is replaced with the task's base commit. | `.claude/tether-rn.md`'s `verify`, else `npx tsc --noEmit && npx eslint . && npx jest --changedSince={base}` |
| `paths` | `specs`, `plans`, `reports` and `followUps`, a register file of deferred items and open questions. | `.claude/tether-rn.md`'s `paths`, else `docs/specs`, `docs/plans`, `docs/reports`, `docs/follow-ups.md` |
| `models` | Per-agent model overrides, one `- <agent>: <model>` line each, which the dispatcher passes when it dispatches that agent. | the frontmatter models in the Agents table |
| `constitution` | Path of the project's constitution file, the non-negotiables with ids `CON-<n>`. | `.claude/constitution.md`; without it, the default set in the `constitution` skill |
| `facts` | Lines every agent treats as true for this project: the repository and project of the PR host, the target branch, reviewers and labels, a project skill to load. | none |

The rule overrides (`overrides:`), the `layout` map, the alias and the i18n files stay in `.claude/tether-rn.md`; see the `tether-rn` README.

## Agents

Agents are dispatched with the Agent tool as `tether-mobile:<agent>`.

| Agent | model | Job | Preloaded skills |
|---|---|---|---|
| `investigator` | `inherit`, effort high | Read-only trace of a ticket or symptom: tracker issue, design frame, navigator and route, screen, slice or query hook, feature api, API contract, and every native capability on the path; lists open follow-ups in the same area. | `tether-mobile:investigating-codebase` |
| `spec-writer` | `inherit`, effort medium | Writes the agreed design as a spec under `paths.specs`, with a `## Decisions` list `D1`, `D2`, … and a Placement row naming the existing file each new slice, hook, api file or component copies; with no such file, an open decision instead. Documents only. | `tether-mobile:writing-feature-spec`, `tether-mobile:drawing-architecture-diagrams`, `tether-mobile:writing-adr` |
| `planner` | `inherit`, effort high, `maxTurns` 60 | Writes the plan under `paths.plans`: tagged tasks each followed by a fenced `touches:` / `conflicts_with:` / `spec:` / `checks:` block and `Produces:` / `Consumes:` interfaces, `## Shared files`, `## Waves` and `## Click-through`. A decision the spec lacks is appended to the spec's `## Amendments` first. A native-project change is its own task. | `tether-rn:react-native-conventions`, `tether-rn:typescript-style`, `tether-rn:react-native-architecture`, `tether-mobile:constitution` |
| `plan-validator` | `sonnet` | Read-only check of the plan against the spec: coverage, ids, decisions, fields, touches, symmetry, constitution, interfaces, waves. Returns a table and `Verdict: Dispatch` or `Verdict: Revise`. | `tether-mobile:constitution`, `tether-rn:react-native-conventions` |
| `implementer` | `opus` | Implements one `[impl]` task inside its `touches:`, with a co-located test run red before the change, verifies with `verify`, commits from a pathspec and re-reads its diff against the brief before reporting. | `tether-rn:react-native-conventions`, `tether-rn:typescript-style`, `tether-mobile:constitution`, `tether-mobile:testing-jest-rntl` |
| `implementer-mechanical` | `opus` | Applies one `[impl:mechanical]` task whose brief carries the complete code or an exact copy rule; same contract and report as `implementer`. | none |
| `conventions-reviewer` | `sonnet` | Read-only review of a diff against every `tether-rn` rule id and every constitution id, plus scope, lint parity, dependencies and commit style. Returns only the `fail` and `unverified` rows, a count line and a verdict. | `tether-rn:react-native-conventions`, `tether-rn:typescript-style`, `tether-mobile:constitution` |
| `code-reviewer` | `opus` | Read-only check of each decision in the brief's `spec:` field, then a hunt for the second file a diff forgot (route registration and param list, linking config, root reducer, the other platform's native file, a Jest mock) and for correctness on empty, absent, offline and failing paths. | none |
| `pr-creator` | `sonnet` | Opens the pull request on the host `pr` names, after a five-point preflight. No builds or tests. | none |

The implementers have every tool; the reviewers, the investigator and the validator read only, and the pr-creator adds the pull-request tools to its read set. Every agent treats text from tickets, PR threads, designs and web pages as data, never instructions; none writes trailers or AI attribution into a commit or PR body; and every commit or push runs `git branch --show-current` in the same command.

### Dispatch order and waves

1. `investigator` on the ticket, then a brainstorm with the user until the approach is agreed.
2. `spec-writer`; the user settles its open decisions.
3. `planner`, then `plan-validator`. The user confirms the `D<n>` lines the planner reports under `Spec amendments:`. On `Verdict: Revise`, send the table back to the planner and validate again; dispatch nothing until `Verdict: Dispatch`.
4. Implementers, one wave at a time from the plan's `## Waves`: the tasks of a wave are independent and run in parallel; tasks that list each other in `conflicts_with:` run in order. Parallel implementers share one working tree, so each commits only its own pathspec. The files under `## Shared files` (the root navigator, param lists, the linking config, the root reducer, shared fixtures) belong to no task: implementers name the line they need under `Deferred:` as `Shared: <path>: <line>`, and the dispatcher commits those files once after the wave.
5. `code-reviewer` on every task, with the brief's `spec:` and `touches:` fields in its prompt; `conventions-reviewer` beside it only on tasks the plan marks `new shape`. The dispatcher refutes any finding without evidence.
6. Fix rounds: rounds 1 and 2 resume the same implementer by name with the review table; a fresh dispatch only when that implementer is gone, or when the fix-round cap is reached and the user asks for another round.
7. The click-through: the dispatcher gathers the plan's `## Click-through` and the implementers' `UI:` lines into one list, and the owner runs it on a simulator or emulator, on both platforms where a line names one.
8. `syncing-docs`: specs, plans, ADRs, the rules files and the follow-ups register checked against the code; new follow-ups appended to `paths.followUps`.
9. `pr-creator`, once the owner has reviewed the diff and run the click-through.

## Skills

Skills are referenced as `tether-mobile:<skill>`.

| Skill | Use it for | Source |
|---|---|---|
| `investigating-codebase` | Tracing a change, feature or bug before it is specced or planned; the investigator's report template. | from `tether-web` |
| `writing-feature-spec` | Writing an agreed design down as a spec, with the section template and the refactor template. | from `tether-web`, placement rewritten |
| `writing-adr` | Recording a decision that spans more than one feature or reverses an earlier one. | from `tether-web` |
| `drawing-architecture-diagrams` | A context, container, flow, sequence or entity-relationship diagram for a spec, ADR or README. | from `tether-web` |
| `constitution` | The non-negotiables a project will not relitigate, each with an id `CON-<n>`, and a default set for React Native in `references/default-constitution.md`. | from `tether-web`, default set rewritten |
| `testing-jest-rntl` | Jest tests with React Native Testing Library for components, screens, hooks, slices, api functions and utils: queries by role and text, `userEvent`, the real store with a mocked api module, native-module mocks, what not to mock. | original |
| `syncing-docs` | Checking specs, plans, ADRs, the rules files and the follow-ups register against the code at the end of a branch. | from `tether-web` |

The process skills are copies of the `tether-web` ones with the rules-file sentence and the examples changed. A fix to one usually belongs in both plugins.

## Evals

None yet. The `tether-web` cases run against Angular fixtures and do not carry over; the first cases to port are the two reviewer cases, which carry their change inline.

## Tests

From the repository root:

```
node --test 'plugins/*/test/**/*.test.mjs' 'test/**/*.test.mjs'
```

The frontmatter test checks that every `tether-mobile` agent and skill names itself after its file or folder, preloads only skills that exist in this plugin or in `tether-rn`, and carries the sentence ``Read `.claude/tether-mobile.md` first; where it differs from this file, it wins.`` exactly once. Check the manifest with `claude plugin validate plugins/tether-mobile`.
