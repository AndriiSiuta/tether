---
description: Write the settings a plugin cannot set (telemetry env, MCP write deny list, MCP pins, sandbox), after Andrii reads the diff
argument-hint: "[--only telemetry|deny|mcp-pins|sandbox] [--user]"
arguments: options
---

Write the harness settings for this project in two passes. Never pass `--yes` on the first pass.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" --dry-run $ARGUMENTS` from the project directory.
2. Show Andrii its output exactly as printed: one block per part, the target file, and the key-level diff. The diff names keys only; the two MCP pins also show their old and new argument strings. Never print a value from a settings file, an MCP entry's `env`, or a token.
3. If every part says `no changes`, stop and say so.
4. Ask Andrii whether to write these changes. Stop unless he answers yes.
5. On his yes, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" --yes $ARGUMENTS` and show its output: the file written and its backup per part. Exit 1 means a target is malformed and nothing was written; report the file and stop.
