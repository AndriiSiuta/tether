---
disable-model-invocation: true
description: Run the frozen eval tasks in throwaway worktrees and write the day's results file, after the user agrees to the cost
argument-hint: "[--tasks <id>[,<id>…]] [--agent <name>] [--all] [--scratch <dir>] [--timeout <min>]"
allowed-tools: ["Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/eval-run.mjs --dry-run:*)"]
---

Run the eval tasks in two passes. Only the dry run is pre-approved; the real run asks for permission.

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/eval-run.mjs --dry-run $ARGUMENTS` from the project directory, unquoted, so it matches the pre-approved rule. It lists each selected task's worktree, agent and verify command and creates nothing. If it exits non-zero, show its stderr and stop.
2. Tell the user what the run costs: every task is one full agent run plus its verify command, so a smoke run of five tasks costs about five implementer runs in tokens and wall time, and each agent run may take up to its timeout (30 minutes unless `--timeout <min>` says otherwise). Name the number of tasks the dry run listed.
3. Ask the user whether to run them, and whether in the background here or in their own terminal. Stop unless they answer yes.
4. The run outlasts the Bash tool's foreground limit, so never run it in the foreground.
   - Here: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/eval-run.mjs $ARGUMENTS` from the project directory with the Bash tool's `run_in_background` set. When it finishes, show its table and the results file path exactly as printed, then the file's `## Change vs` section if it has one.
   - The user's terminal: give the user that command with `${CLAUDE_PLUGIN_ROOT}` expanded to the plugin's absolute path, to run from the project directory, and stop.
5. A run that is interrupted removes its current worktree; the next run sweeps any `eval-*` worktree left in the scratch directory.
