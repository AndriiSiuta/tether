---
description: The plan validator returns Revise when a spec decision is cited by no task.
expected_outcome: 'The returned table has the columns Task, Check, Verdict and Evidence, has a row naming D3 as cited by no task, and the final line is Verdict: Revise.'
tags: [smoke, plan-validator]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Agent, Read, Glob, Grep]
---

Dispatch the `tether-web:plan-validator` agent with the brief between BEGIN BRIEF and END BRIEF, word for word, and then reply with the table it returns, unchanged.

BEGIN BRIEF
Spec: `docs/specs/2026-10-02-order-status-filter.md`. Plan: `docs/plans/2026-10-02-order-status-filter.md`. Both paths are relative to the current working directory, which is the codebase the plan targets (`libs/`, `apps/`, `tsconfig.base.json`); it has no git history. There is no `.claude/tether-web.md`, no `.claude/tether-nx.md` and no `.claude/constitution.md`, so the defaults apply.
END BRIEF
