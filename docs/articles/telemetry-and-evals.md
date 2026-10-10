# Telemetry and evals: how we know the harness works

*11 October 2026*

A harness for Claude Code is a pile of claims. The guard blocks bad commits. The planner writes tasks a reviewer can read. The reviewer catches the import rule. Each claim is cheap to write and expensive to believe. Two things turn claims into evidence: telemetry, which shows what every session actually did and cost, and evals, which run an agent against a frozen case and grade the result. This is how [tether](../plugins/tether/README.md) does both, and what we learned setting them up.

## Telemetry: one container, on localhost

Claude Code can export OpenTelemetry metrics, logs and traces. tether's telemetry part points them at one local container, `grafana/otel-lgtm`, pinned by digest and bound to `127.0.0.1`. Nothing leaves the machine, and everything is kept for 14 days.

`/tether:setup --only telemetry` writes the environment Claude Code needs: the OTLP exporters over gRPC to port 4317, tool details on so the Bash command text and MCP tool names of every call land in Loki, and prompts, responses, tool content and raw API bodies all off. `/tether:telemetry up` starts the stack, after asking once before it pulls the image.

The Grafana dashboard, "Tether: Claude Code", has seven panels:

| Panel | What it answers |
| --- | --- |
| Tokens by agent and model | Which agents eat the budget, and on which model |
| Cost by agent and model | The same in dollars |
| Tool failures by tool | Which tool calls fail, and how often |
| Tool decision rejects by source | What the permission layer and the hooks refused |
| Auto gate denied | What the auto-mode classifier stopped |
| MCP connection errors | Which servers are flaky |
| Session traces | One row per session, to find the one you mean |

A `Repository` variable splits the token and cost panels by repository. It reads the `vcs_repository_name` label that Claude Code adds when `OTEL_METRICS_INCLUDE_REPOSITORY` is set. Sessions that run outside a repository, such as a memory plugin's observer, carry no label and drop out once a repository is picked, which is also the easiest way to see what that observer costs.

The telemetry feeds two other tools. `/tether:ledger` fills the token ledger of a run report from the recorded sessions, so the per-agent totals in a report are measured, not copied from completion notices. And the eval runner reads a session's tokens and wall time from the same store when the stack is up.

Two things we got wrong. The dashboard's first version filtered on a `repository` label that does not exist; the metrics carry `vcs_repository_name`, `vcs_owner_name` and `vcs_repository_url_full`. And the dashboard file is bind-mounted into the container, but Grafana applied an edit only after a restart, so `/tether:telemetry down` and `up` are part of changing it.

## Evals, two kinds

tether runs evals two ways, for two different questions.

**Frozen tasks against your own repository.** `/tether:eval` reads the task files named in `harness.json`: each is a small JSON record with the agent to dispatch, a base commit, the paths a good change touches and the strings a good answer must contain. The runner creates a throwaway git worktree at the base commit, symlinks what the project needs, such as `node_modules`, dispatches the agent, runs the project's verify command, and scores the result: pass or fail from the verify command, paths hit, strings caught, tokens and wall time. The worktree never contains the tasks or the results folder, so the agent cannot read the expected answers. Only a dry run is pre-approved; a real run asks first, because it costs one full agent run per task.

**Cases against the plugin.** The sibling plugin, [tether-nx](../plugins/tether-nx/README.md), ships five cases in Claude Code's own `claude plugin eval` format: a prompt, an optional `case.yaml` and a folder of graders. Each case dispatches one agent against a small fixture over a neutral orders-and-invoices domain. The graders are mostly regexes over the trace and tool checks, with one model-graded case:

| Case | What must happen |
| --- | --- |
| Reviewer flags a root domain service | The conventions review marks the rule failed for a data-access service provided in root |
| Reviewer flags a feature import | The review marks the rule failed for a feature library importing another |
| Reviewer without a mode is blocked | A dispatch with no mode line gets a `Blocked:` reply and no table |
| Planner task headings | Every task is headed `### Task <N>: [tag] <title>`, one tag each, at most 12 |
| Implementer blocks on open placement | A brief that leaves placement open gets a `Blocked:` report and no written file |

A cheap pass is one run per case with no baseline arm:

```
claude plugin eval plugins/tether-nx --ablation none --runs 1 --no-publish
```

Drop the two flags and the runner does three runs per case with and without the plugin, which reports what the plugin adds over the bare model. A day of eval runs, three runs per case, several reruns, cost about $7.

## What the evals taught us

The first full run passed three cases of five, and two of the three passes were worth less than they looked.

One failure was the fixture's fault. The case for "a data-access service must not be provided in root" used an HTTP client wrapper as its fixture, and the rule under test explicitly exempts those. The agent was right and the grader was wrong. The fixture became a stateful service.

The other failure took reading the Claude Code binary. A case can declare extra directories under `context.add_dirs`, and the runner grants the agent read access to them. It never tells the agent where they are: no path in the prompt, no placeholder, no announcement. The planner exhausted every read strategy it had and reported that the workspace did not exist. The fix is a `scaffold_script` that copies the fixture into the run's working directory, which the agent does know, and the `--scaffold` flag when running. The implementer case had the same shape and passed anyway, by blocking, which is what the brief asked for, but it was blocking because it could not see the code. With its fixture staged it still blocks, now for the right reason.

Two rules for a memory plugin in the loop. The eval runner sets `CLAUDE_MEM_DISABLE_OBSERVATION` and `CLAUDE_MEM_DISABLE_TOOL_HOOKS` for the agent under test, so a fixture run never becomes project history. And the observer's sessions show in Grafana like any other, so pick a repository in the dashboard before reading a cost figure.

## Where this leaves the score

On the harness scorecard, ten areas of five points, telemetry sits under observability and is at five: the stack runs, the dashboard splits by repository, and the ledger is filled from it. Evals are at four. The fifth point is an eval for tether's own hooks, which needs a git repository as a fixture and Bash allowed inside the eval sandbox, and is the next thing to build.
