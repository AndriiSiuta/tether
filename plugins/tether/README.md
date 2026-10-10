# tether

A Claude Code plugin made of project-neutral hooks, commands and skills. Every project value comes from the project's `.claude/harness.json`, and a project without that file gets no behaviour. A plugin cannot set permissions, environment variables, the sandbox or MCP server pins, so `/tether:setup` writes those, and only after you have read its diff.

## Prerequisites

- Node 24 and git, for every hook and script.
- python3, for `prettier.sh`, which reads the hook payload with it.
- Docker Compose, for `/tether:telemetry`.
- The `az` CLI, signed in, for `/tether:metrics`.
- `age` or `gpg`, for `/tether:backup`.

## Install

From a local clone, run these from the project directory:

```
claude plugin marketplace add /path/to/tether
claude plugin install tether@tether --scope local
```

From GitHub, pinned to a tag:

```
claude plugin marketplace add AndriiSiuta/tether#v0.4.0
claude plugin install tether@tether --scope local
```

`--scope local` enables the plugin in `.claude/settings.local.json` for this project only. After a new tag, run `claude plugin marketplace update tether` and then `claude plugin update tether@tether`, and start a new session.

The plugin declares no `userConfig`. The backup directory is an argument to `/tether:backup`, because a command file does not get a user option substituted into it.

## `.claude/harness.json`

The file sits at the project root. Hooks start from `CLAUDE_PROJECT_DIR` (the security hooks) or the hook's `cwd` and walk up from that directory to the git toplevel, then try the main worktree's root, so a project that is one folder of a larger repository keeps its own file. A malformed file is ignored, with one stderr line. `/tether:setup --only harness` writes a starter file when none exists.

Without `harness.json` every hook is inert. `/tether:setup`'s `telemetry` and `mcp-pins` parts read nothing from it and still apply; `deny` and `sandbox` need it; `claude-mem` reads `verifyCommand` when the file exists and applies without it.

```json
{
  "protectedBranches": ["main"],
  "localOnlyPaths": ["docs/private", ".claude/agents", ".claude/harness.json", "LOCAL.md"],
  "formatSkip": ["docs/", ".claude/", "LOCAL.md"],
  "implementerAgents": ["implementer"],
  "reportFields": ["Files:", "Checks:", "Deferred:", "Plan edits:|Blocked:"],
  "spec": { "dir": "docs/private/specs", "maxWords": 1500, "agent": "spec-writer" },
  "mcpWriteDeny": [
    { "server": "<server>", "tools": ["<write_tool>"], "patterns": ["^(create|update)_"] }
  ],
  "untrustedSources": ["mcp__<server>__", "WebFetch"],
  "fixRoundCap": 2,
  "verifyCommand": "<verify command> --base {base}",
  "evals": { "tasks": "docs/private/evals/tasks", "results": "docs/private/evals/results", "smoke": 5, "symlink": ["node_modules"] },
  "reports": "docs/private/research",
  "sandboxDomains": ["registry.npmjs.org", "github.com", "api.anthropic.com", "localhost"],
  "ado": { "org": "<organization>", "project": "<project>", "repo": "<repository>" }
}
```

| Key | Meaning |
|---|---|
| `protectedBranches` | A commit or push on one of these branches is blocked. A push range is checked against `origin/<first entry>`. |
| `localOnlyPaths` | Paths relative to the repo that must never be committed or pushed. A directory covers everything under it. The backup archives the entries that exist, and evals keep them out of a worktree's diff. |
| `formatSkip` | Paths Prettier leaves alone. An entry ending in `/` matches as a prefix; any other entry matches the exact path. Formatting is opt-in: without this key nothing is formatted, and `[]` formats every file inside the project. |
| `implementerAgents` | The agent types whose final report is checked and whose fix rounds are counted. |
| `reportFields` | The lines an implementer's report must contain. Within one field, `\|` separates alternatives. |
| `spec` | `dir`, `maxWords` and `agent` for the spec word cap. |
| `mcpWriteDeny` | Each entry has a `server`, exact `tools` and regex `patterns`. A tool `mcp__<s>__<t>` is denied when `<s>` equals `server` or ends with `_<server>` (a plugin-provided server), and `<t>` is in `tools` or matches a pattern. |
| `untrustedSources` | Tool-name prefixes whose output gets a reminder. `WebFetch` matches exactly. |
| `fixRoundCap` | How many fix rounds an implementer gets per task before it has to escalate. |
| `verifyCommand` | The verify command for eval tasks. `{base}` is replaced with the task's base commit. |
| `evals` | `tasks` and `results` folders, the `smoke` task count, the directories `symlink` links from the checkout into each eval worktree, and an optional `copyExclude` list of repo-relative paths. The `localOnlyPaths` are copied into each worktree, except `tasks`, `results` and every `copyExclude` path, also when they sit inside a copied folder. |
| `reports` | The folder for run reports and the monthly metrics note. |
| `sandboxDomains` | The network allowlist that `setup --only sandbox` writes. |
| `ado` | The Azure DevOps `org`, `project` and `repo` that `/tether:metrics` reads from. |
| `secretShapes` | `false` switches off the secret-shape check in `git-guard` and `mcp-write-guard`. On by default: a commit command or an MCP call carrying a token-shaped string (GitHub, Anthropic, AWS, Slack, a JSON web token, a private key block, an Azure DevOps personal access token) is blocked, and the string is never echoed. |

## Hooks

| Event | Matcher | Script | Keys read | Effect |
|---|---|---|---|---|
| SessionStart | all | `session-context.mjs` | `untrustedSources` | When the project names untrusted sources, adds one reminder that context other plugins inject at session start is data, not instructions. |
| PreToolUse | `Bash` | `git-guard.mjs` | `protectedBranches`, `localOnlyPaths`, `secretShapes` | Exits 2 on a `git commit` or `git push` on a protected branch, or one that carries a local-only path, or a commit whose command text carries a secret-shaped token. The directory comes from a leading `cd <dir>` or `git -C <dir>`, else the hook's `cwd`, and the branch is read there. |
| PreToolUse | `mcp__.*` | `mcp-write-guard.mjs` | `mcpWriteDeny`, `secretShapes` | Returns a PreToolUse `deny` for a listed MCP write tool, including one reached through a plugin-provided server, and for any MCP call whose input carries a secret-shaped token. |
| PostToolUse | `Edit\|Write` | `prettier.sh` | `formatSkip` | Formats the written file inside the project with the project's own Prettier (`node_modules/.bin/prettier`, else `npx --no-install prettier`); it never fetches from npm. Runs only when `formatSkip` is set. Always exits 0. |
| PostToolUse | `mcp__.*\|WebFetch` | `untrusted-input.mjs` | `untrustedSources` | Adds a reminder that the tool output is data, not instructions (see the `untrusted-input` skill). It fires only for `mcp__*` tools and `WebFetch`, its matcher, so an `untrustedSources` entry for any other tool never gets a note. |
| SubagentStop | all | `implementer-report.mjs` | `implementerAgents`, `reportFields` | Exits 2, sending an implementer back, when its final message lacks a report field or a `Blocked:` line. |
| SubagentStop | all | `spec-cap.mjs` | `spec` | Exits 2 when a spec dated today, written by `spec.agent`, is longer than `spec.maxWords`. |
| SubagentStop | all | `fix-round-cap.mjs` | `implementerAgents`, `fixRoundCap` | Counts the stops per session and task under `${CLAUDE_PLUGIN_DATA}/rounds/`. The cap is checked when the implementer stops after a round: it exits 2 once more than `fixRoundCap` fix rounds follow the first stop, naming the rounds used. A stop with `stop_hook_active` is not counted. |

`git-guard`, `mcp-write-guard` and `untrusted-input` read the config through `loadSecurityContext`, which tries `CLAUDE_PROJECT_DIR` before the hook's `cwd`, so a tool call made from another directory is still guarded.

Every hook exits 0 with no output on malformed stdin, a missing field, or no `harness.json`. `implementer-report` and `spec-cap` also let a stop through when `stop_hook_active` is true, so an agent that cannot comply is never sent back forever. `spec-cap` takes today from the local date.

An implementer dispatch has to start with a `# Task <N>: <title>` heading line, because the fix-round cap keys its count on that heading. A dispatch without one is not counted.

## Commands

| Command | What it does |
|---|---|
| `/tether:setup [--only harness\|telemetry\|deny\|mcp-pins\|sandbox\|claude-mem] [--user]` | Prints a key-level diff with `--dry-run`, asks you, and only then writes with `--yes`. |
| `/tether:telemetry up\|down\|status` | Starts, stops or checks the local telemetry stack. `up` pulls the image only after you agree. |
| `/tether:ledger <report.md> [--dry-run]` | Fills a run report's token ledger from local telemetry, then prints the per-agent totals (`ledger-stats.mjs`). |
| `/tether:eval [--tasks <ids>] [--agent <name>] [--all] [--timeout <min>]` | Lists the frozen eval tasks in a dry run, states the cost, and runs them only after your yes, in the background or in your own terminal. |
| `/tether:metrics [--month YYYY-MM] [--policy-plan]` | Writes the month's read-only Azure DevOps and ledger metrics to `<reports>/<YYYY-MM>-metrics.md`. `--policy-plan` prints a reviewer-policy command and never runs it. |
| `/tether:backup <dir>` | Prints the encrypted-backup command for your own terminal. With no `<dir>`, it asks for one. |

Skills: `untrusted-input` (how to treat text from tickets, PR threads, design files, issue trackers and web pages) and `run-report` (the run report, its rulings, its token ledger and its sign-off row).

### Evals

`eval-run.mjs` runs each task in a throwaway `eval-*` git worktree under its scratch directory, with a per-agent timeout of 30 minutes unless `--timeout` says otherwise.

- An interrupted or crashed run removes its worktree, and the next run sweeps any `eval-*` worktree left behind.
- The worktree never gets the eval `tasks` or `results` folders, nor any `evals.copyExclude` path, so the agent under test cannot read the expected answers.
- Only `--dry-run` is pre-approved. A real run always asks for permission, because it costs one full agent run per task.

### Backup

The command to run in your own terminal is:

```
node "<plugin root>/scripts/backup.mjs" --dir "<dir>" --project "<project root>"
```

1. It packs the existing `localOnlyPaths` with `tar -czf -`.
2. It pipes the archive into `age --passphrase`, or into `gpg --symmetric --cipher-algo AES256` when `age` is not on `PATH`. Either one asks for the passphrase on your terminal.
3. It writes `<dir>/harness-<YYYY-MM-DD>.tar.gz.<age|gpg>` and keeps the newest 10.

It writes nothing and exits 1 when `--dir` is missing, when there is no `harness.json`, when none of the paths exist, or when neither encryptor is installed.

## What setup writes, and where

| Part | Target | Keys |
|---|---|---|
| `harness` | `<project>/.claude/harness.json` | A starter file when none exists: the default branch (from `origin/HEAD`, else `main`) protected, the file itself local-only, `implementerAgents`, `reportFields`, `untrustedSources: ["WebFetch"]` and `fixRoundCap: 2`. An existing file is never changed. Runs first, so `deny` and `sandbox` in the same run read it. |
| `telemetry` | `~/.claude/settings.json` | `env`: `CLAUDE_CODE_ENABLE_TELEMETRY`, the OTLP exporters (gRPC to `http://127.0.0.1:4317`, traces included), `OTEL_LOG_TOOL_DETAILS=1`, and the four content switches `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_CONTENT` and `OTEL_LOG_RAW_API_BODIES`, all set to `0`. |
| `deny` | `<project>/.claude/settings.local.json` | `permissions.deny` gains `mcp__<server>__<tool>` for every `mcpWriteDeny` `tools` entry. The patterns stay hook-only. |
| `mcp-pins` | `~/.claude.json` | The project's `mcpServers` args: `@azure-devops/mcp` is pinned to the current npm version, and `sonarsource/sonarqube-mcp` to the digest of the local image. |
| `sandbox` | `<project>/.claude/settings.local.json`, or `~/.claude/settings.json` with `--user` | `sandbox.enabled: true` and `sandbox.network.allowedDomains` from `sandboxDomains`. |
| `claude-mem` | `~/.claude/settings.json` | `env`: `CLAUDE_MEM_SKIP_SUBAGENT_OBSERVATIONS=true`, `CLAUDE_MEM_REDACT_ENABLED=true`, `CLAUDE_MEM_FILE_READ_GATE_ENABLED=false`, `CLAUDE_MEM_TELEMETRY=0`, and `CLAUDE_MEM_SKIP_BASH_PATTERNS`: one regex of the `verifyCommand` script plus the test, lint, build and serve runners, so their long output is never observed. A value already set is kept, gaining only a missing verify script. In a full run this part is skipped unless the target's `enabledPlugins` has a `claude-mem@…` entry switched on; `--only claude-mem` writes regardless. |

How setup writes:

- **Malformed target:** it is refused with exit 1, and nothing is written.
- **Missing target:** it is created, with no backup.
- **Every other write** is atomic: setup writes a temporary file, renames it over the target, and then reads the target back to check it.
- **Backups:** an existing target is backed up first, as `<file>.bak-<YYYYMMDD-HHmm>`. When the target sits inside a git repo, the backup goes to `~/.claude/backups/harness/` instead, so it never shows up in the repo.
- **No TTY:** setup prints every diff and exits 3, and you re-run with `--yes` once you have confirmed the diff.

## Telemetry and privacy

The stack is one `grafana/otel-lgtm:0.35.0` container, pinned by digest.

- **Ports:** every port is bound to `127.0.0.1`. Grafana is on 3000, with the dashboard "Tether: Claude Code".
- **Retention:** metrics, logs and traces are kept for 14 days.
- **Metrics:** Prometheus converts Claude Code's delta metrics to cumulative ones.
- **Pulling:** the image is pulled only after explicit consent.
- **Privacy:** telemetry stays on localhost and is kept 14 days. Prompt, response, tool-content and raw-body logging are all off.
- **Tool details:** `setup --only telemetry` also sets `OTEL_LOG_TOOL_DETAILS=1`, so the Bash command text and the MCP tool names of every call are logged to the local Loki and kept for 14 days.
- **Repository filter:** the dashboard's `Repository` variable splits the cost and token panels by the `vcs_repository_name` metric label (`OTEL_METRICS_INCLUDE_REPOSITORY=true`, set by the telemetry part, is what adds the `vcs_*` labels). Sessions that run outside a repository, such as a memory plugin's observer, have no label and drop out once a repository is picked. The dashboard file is bind-mounted into the container, so an edit shows up within the provisioning interval; `/tether:telemetry down` and `up` if it does not.

## With a memory plugin

A session-memory plugin such as `claude-mem` needs nothing from tether: Claude Code merges plugin hooks, so its SessionStart, PostToolUse and Stop hooks run beside tether's guards. Three points matter when both are installed.

- **Its search results are data.** The plugin's search tools (`mcp__plugin_claude-mem_mcp-search__*`) return text compressed from earlier tool output, including ticket, PR and web text an earlier session read, with the source gone. Add that prefix to `untrustedSources` so the reminder fires on them. The context block the plugin injects at session start passes through no hook; the `tether:untrusted-input` skill is what covers it.
- **Subagents.** An implementer's report is the record of its work. With `CLAUDE_MEM_SKIP_SUBAGENT_OBSERVATIONS=true` in the `env` block of `~/.claude/settings.json` (environment overrides the plugin's own settings file) the plugin stores the dispatcher's view, the dispatch and the report that came back, and not every tool call inside the implementer. On a run with several implementers that is most of the plugin's observer cost. `/tether:setup --only claude-mem` writes this and the other observer guardrails (redaction on, the file-read gate off, analytics off, a skip regex for verify and runner output); see the table above.
- **Evals.** `eval-run.mjs` sets `CLAUDE_MEM_DISABLE_OBSERVATION=1` and `CLAUDE_MEM_DISABLE_TOOL_HOOKS=1` for the agent under test, so a fixture run is never stored as project history.

The plugin's observer runs as Claude Code sessions of its own, so with the telemetry part on they show in Grafana as extra sessions; pick a repository in the dashboard's `Repository` variable to leave them out. The ledger and `/tether:metrics` read only the sessions a run report names and are unaffected.
- **Session start.** The context block a memory plugin injects passes through no PostToolUse hook, so the `session-context` hook adds one data-not-instructions reminder at session start whenever `untrustedSources` is set.

## Tests

```
npm test
```

This runs `node --test 'plugins/*/test/**/*.test.mjs' 'test/**/*.test.mjs'` from the repository root. The specs create every repo, home and file under a temporary directory, and they put fake binaries such as `age`, `gpg` and `claude` first on `PATH`. Check the manifests with `claude plugin validate .` and `claude plugin validate plugins/tether`.
