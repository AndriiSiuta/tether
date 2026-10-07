---
description: The planner writes a plan whose tasks use the tagged heading shape and stay within the task cap.
expected_outcome: 'The file docs/plans/order-status-filter.md exists, each task heading reads ### Task N, a colon, one bracketed tag and a title, and there are at most 12 tasks.'
tags: [planner]
max_turns: 20
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Write]
---

Dispatch the `tether-nx:planner` agent with the brief between BEGIN BRIEF and END BRIEF, word for word, and then reply with its report.

BEGIN BRIEF
The approved spec is `docs/specs/2026-10-01-order-status-filter.md` inside the read-only `workspace` directory added to this session, and that directory is the codebase to plan against. There is no `.claude/tether-nx.md`, so the defaults apply. The workspace is read-only: write the plan to `docs/plans/order-status-filter.md` in the current working directory instead, under exactly that name.
END BRIEF
