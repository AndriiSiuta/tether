# Changelog

All notable changes to the `tether` marketplace and its plugins. Versions follow the plugins' `version` fields; tags cover the whole repository.

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
