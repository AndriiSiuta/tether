# Changelog

All notable changes to the `tether` marketplace and its plugins. Versions follow the plugins' `version` fields; tags cover the whole repository.

## Unreleased

## v0.4.1

### tether 0.4.1
- The dashboard `Repository` variable reads the `vcs_repository_name` label the metrics carry; `repository` matched nothing.

### tether-nx 0.2.1 (unchanged version)
- The `implementer-blocks-on-open-placement` eval case stages its fixture with `scaffold.sh` like the planner case, so its pass is for the right reason (3 of 3 with the codebase visible).

## v0.4.0

### tether 0.4.0
- `harness.json` is looked up from the hook's directory up to the git toplevel, so a project that is one folder of a larger repository keeps its own file. `setup --only deny` no longer writes an empty `permissions.deny`.
- `git-guard` blocks a commit whose command text carries a secret-shaped token, and `mcp-write-guard` denies any MCP call whose input carries one (GitHub, Anthropic, AWS, Slack, JSON web token, private key block, Azure DevOps personal access token); `secretShapes: false` switches both off. The string is never echoed.
- A `SessionStart` hook, `session-context.mjs`, adds one data-not-instructions reminder when `untrustedSources` is set, covering the context block a memory plugin injects.
- `/tether:setup --only harness` writes a starter `.claude/harness.json` when none exists and runs first in a full run.
- The Grafana dashboard gains a `Repository` variable on the cost and token panels.

### tether-nx 0.2.1
- The `reviewer-flags-root-domain-service` eval fixture is a stateful domain service instead of an HTTP client, which `DI-2` itself exempts as a cross-scope API client; the brief says which screen uses it.
- The `planner-task-headings` eval case stages its fixture with a `scaffold_script` (run with `--scaffold`): the runner grants reads on `add_dirs` but never tells the agent the path, so the planner could not find the spec.

## v0.3.0

### tether 0.3.0
- `/tether:setup --only claude-mem`: a fifth part writing the `claude-mem` observer guardrails to the user `env` (`CLAUDE_MEM_SKIP_SUBAGENT_OBSERVATIONS`, `CLAUDE_MEM_REDACT_ENABLED`, `CLAUDE_MEM_FILE_READ_GATE_ENABLED`, `CLAUDE_MEM_TELEMETRY`, and a `CLAUDE_MEM_SKIP_BASH_PATTERNS` regex built from `verifyCommand` plus the runner default). A full run skips it unless the plugin is enabled.
- `eval-run.mjs` passes `CLAUDE_MEM_DISABLE_OBSERVATION=1` and `CLAUDE_MEM_DISABLE_TOOL_HOOKS=1` to the agent under test, so an eval run is never stored by the `claude-mem` memory plugin.
- README section "With a memory plugin" (search results as untrusted input, subagent observations, evals, telemetry); threat model asset, input row and residual risk for a memory plugin's store.

### tether-nx 0.2.0
- The investigator's sweep queries the session's memory search tool when one exists; README note "With a memory plugin".
- Five eval cases under `plugins/tether-nx/evals/` in the `claude plugin eval` format: the reviewer flags `DI-2` and `FEAT-3`, the reviewer blocks without a mode, the planner's task headings and cap, and the implementer's `Blocked:` report on open placement. See the plugin README's Evals section.

### Repository
- CI on push and pull request to `main`: `npm test` on Node 24 and `claude plugin validate` for the marketplace and both plugins. The neutrality denylist check is skipped in CI with a visible notice.
- `SECURITY.md` (supported versions, private reporting, what counts) and `docs/threat-model.md` (inputs, guards, residual risks).
- `CONTRIBUTING.md`: setup, the inert-by-default and fail-open hook rules, the neutrality denylist, commit style, and stable `tether-nx` rule ids.
- Issue forms (bug, guard gap, rule doesn't fit) with blank issues off, and a pull request template.
- Root README: CI badge, context cost estimates, platforms, and links to the security and contributing docs.
- The neutrality scope allowlist accepts the Claude Code CLI's npm scope.

## v0.2.0

### tether 0.2.0
- Renamed from `harness`. The marketplace maps the old name to the new one, so an installed `harness` plugin moves over on update. Commands are now `/tether:*` and skills `tether:*`.
- Config, data and environment names stay the same (`.claude/harness.json`, `HARNESS_OTEL_ENDPOINTS`, the telemetry project and the backup file names), so existing setups keep working.
- The fix-round cap only keys on task headings that carry a number (`## Task 3`), so a plan's `## Task order` heading no longer shares a count.

### tether-nx 0.1.0 (new)
- Agents: `investigator`, `spec-writer`, `planner`, `implementer`, `implementer-mechanical`, and `reviewer` with `conventions` and `pairings` modes.
- Skills: `angular-nx-conventions` (25 rules with stable ids), `typescript-style`, `angular-architecture`, `investigating-codebase`, `writing-adr`, `drawing-architecture-diagrams`, `writing-feature-spec`, and the vendored `ng-performance` and `ng-accessibility` (MIT; see `plugins/tether-nx/NOTICE`).
- A project overrides any rule in `.claude/tether-nx.md`; without that file the defaults apply.

### Repository
- `test/neutrality.test.mjs` checks committed files, paths and commit messages against a local, git-ignored denylist; `test/frontmatter.test.mjs` checks every agent and skill.
- Root README.

## v0.1.1
- MIT license.

## v0.1.0
- First release of the plugin (then named `harness`): git guard, MCP write guard, untrusted-input reminder, Prettier hook, implementer report check, spec word cap, fix-round cap, `/setup` for deny lists, MCP pins, telemetry and sandbox settings, a localhost OpenTelemetry stack with a dashboard, ledger filling from telemetry, an eval runner, monthly metrics and an encrypted backup.
