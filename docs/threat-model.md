# Threat model

What the `tether` and `tether-nx` plugins defend against, which part does the defending, and what is left over. The plugins sit inside a Claude Code session; they do not replace Claude Code's own permission system, sandbox or review of what the model does.

## Assets

- The project's protected branches and the history pushed from them.
- Local-only paths a project keeps out of git: private specs, plans, agent definitions, the harness config.
- Write access to issue trackers, code hosts and other services reached through MCP servers.
- Credentials and environment variables on the developer's machine.
- The local telemetry data, which holds Bash command text and tool names.

## Inputs and the guard that covers each

| Input | Risk | Guard |
|---|---|---|
| Ticket text, PR and issue comments read through an MCP server | Instructions planted in data steer the model into writing, pushing or posting. | `untrusted-input` hook (PostToolUse on `mcp__.*`) adds a reminder that the output is data; the `tether:untrusted-input` skill; `mcp-write-guard` denies listed write tools; `/tether:setup --only deny` adds the exact tools to `permissions.deny`. |
| Design files read through an MCP server | Same as above: text inside a frame or a comment read as an instruction. | `untrusted-input` and `mcp-write-guard`, as above. |
| Web pages read with `WebFetch` | Instructions planted in a page. | `untrusted-input` hook (PostToolUse on `WebFetch`); `/tether:setup --only sandbox` limits network domains for shell commands. |
| npm packages and other dependencies | A package, or a formatter it brings, runs code on install or on every edit. | The Prettier hook (`prettier.sh`) uses only the project's installed Prettier and never fetches from npm; `/tether:setup --only mcp-pins` pins MCP server packages and images to a version or digest; `tether-nx` agents ask before adding a dependency (`DEP` row of the reviewer). |
| MCP servers | A server changes behaviour on update, or exposes write tools the session should not use. | `/tether:setup --only mcp-pins`; `mcp-write-guard` with `mcpWriteDeny`; `/tether:setup --only deny`. |
| The model's own drift | Commits on the wrong branch, local-only files committed, specs that grow without bound, fix loops, reports that skip their checks. | `git-guard` (PreToolUse on `Bash`) blocks commits and pushes on `protectedBranches` and with `localOnlyPaths`; `spec-cap`, `fix-round-cap` and `implementer-report` (SubagentStop); the `tether-nx` reviewer's `Mode: conventions` and `Mode: pairings`. |

## Residual risks

- **Pattern-only MCP denies have no `permissions.deny` twin.** `/tether:setup --only deny` writes the exact `tools` of each `mcpWriteDeny` entry; a tool denied only by a regex in `patterns` is stopped by the hook alone, so a disabled or failing hook lets it through.
- **Hooks fail open by design.** Every hook exits 0 on malformed input, a missing field or no `harness.json`, so a broken config or a crash in a hook removes that guard instead of blocking work. This keeps a plugin bug from locking a developer out, and it means a guard is not a security boundary.
- **The git guard reads command text.** `git-guard` matches the Bash command string with regular expressions and reads the directory from a leading `cd` or `git -C`. A command that builds a path or a branch at run time, through a variable, a subshell, a script file or an alias, can evade it. Claude Code's permission rules and the sandbox are the stronger layer.
- **Telemetry logs Bash command text locally.** `/tether:setup --only telemetry` sets `OTEL_LOG_TOOL_DETAILS=1`, so every Bash command, including any secret typed into one, is stored in the local Loki for 14 days. Prompt, response, tool-content and raw-body logging stay off, and every port binds to `127.0.0.1`.
- **The sandbox is not on by default.** A plugin cannot enable Claude Code's sandbox; `/tether:setup --only sandbox` writes it only when you run it and agree to the diff.
- **A killed eval run leaves a worktree.** `eval-run.mjs` removes its `eval-*` worktree on interrupt or crash, but a SIGKILL skips that cleanup, and the worktree, with any local-only files copied into it, stays until the next eval run sweeps it.

## Out of scope

- Claude Code itself, its permission system and its sandbox.
- A malicious plugin installed beside these ones, and a compromised machine.
- MCP servers and their own access controls.

Report a gap in anything above as described in [SECURITY.md](../SECURITY.md).
