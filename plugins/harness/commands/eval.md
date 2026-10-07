---
description: Run the frozen eval tasks in throwaway worktrees and write the day's results file, after Andrii agrees to the cost
argument-hint: "[--tasks <id>[,<id>…]] [--agent <name>] [--all] [--scratch <dir>]"
allowed-tools: ["Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/eval-run.mjs:*)"]
---

Run the eval tasks in two passes. Never start the real run before Andrii's yes.

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/eval-run.mjs --dry-run $ARGUMENTS` from the project directory, unquoted, so it matches the pre-approved rule. It lists each selected task's worktree, agent and verify command and creates nothing. If it exits non-zero, show its stderr and stop.
2. Tell Andrii what the run costs: every task is one full agent run plus its verify command, so a smoke run of five tasks costs about five implementer runs in tokens and wall time. Name the number of tasks the dry run listed.
3. Ask Andrii whether to run them. Stop unless he answers yes.
4. On his yes, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/eval-run.mjs $ARGUMENTS`. Show its table and the results file path exactly as printed, then the file's `## Change vs` section if it has one.
