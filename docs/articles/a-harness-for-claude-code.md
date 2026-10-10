# A harness for Claude Code: memory, guard rails and a score

*11 October 2026*

Claude Code is good at writing code and bad at remembering rules. Left alone, an agent will commit a file you told it never to commit, paste a token into a commit message, and forget by Tuesday what it learned on Monday. This repository is what we built around it so that the agent can be trusted with a production codebase. It took two days to bring the pieces together, and this is the short version.

## Two memories

The first thing an agent needs is a memory that outlives a session. We run two.

The curated one is a folder of small Markdown files, one fact each: a review bar, a decision, the state of a pull request. A person or the agent writes them on purpose, and the agent reads the index at the start of every session.

The automatic one is [claude-mem](https://github.com/thedotmack/claude-mem). A second, smaller model watches each session, writes short observations into a local database, and injects a summary of recent work next time. Nobody curates it, which is the point: it remembers what was tried, not only what was decided.

The automatic memory needs guardrails, set before its first run: no observations from subagents, no summaries of test output, redaction on, telemetry off. The observer is a model like any other, billed to the same plan, and it sees everything the session sees.

## Guard rails that do not trust the model

The second thing an agent needs is a set of checks it cannot talk its way past. That is [tether](../plugins/tether/README.md), the plugin in this repository. Its hooks run as shell processes around tool calls and read every project value from one file, `.claude/harness.json`:

- A git guard blocks a commit or push on a protected branch, one that carries a local-only path, and a commit whose text carries a token shape.
- A deny list blocks MCP tools that write where they should not, such as a design file or a wiki page.
- A reminder lands on every result that comes from an untrusted source, a ticket, a web page, a memory search, and once at session start.
- An implementer's report must carry the fields a reviewer needs. A spec has a word cap. A fix loop has a round cap.

The plugin names no project. The same hooks run on two repositories today with two different `harness.json` files.

## A score out of 50

"Is the harness good enough" needs a number that moves. We score ten areas, five points each: guards, untrusted input, agents, process controls, tests and CI, evals, observability, setup, docs, adoption. A point is claimed when something runs and is seen to run, never when it is written.

On the morning of 10 October the harness scored 38. The next day it scored 45. The seven points came from small things done and then checked: a nested config lookup, secret-shape checks, a session-start reminder, a dashboard filter, five eval cases passing for reasons that hold, and the hooks finally seen to fire in a live session.

The last five points are the expensive ones: an eval for the guards themselves, a per-run cost cap, and adoption beyond one person. If you use the plugin, you are one of those points. Issues and pull requests are welcome.

## Three things we got wrong first

- Enabling a plugin in settings is not installing it. Without an install record for the project, the setting enables nothing and a reload reports success. Probe every guard with a command it must block.
- `skillOverrides` does not reach plugin skills. The switch for a plugin skill you do not want is an instruction the model reads, or a permission deny.
- A guard that greps the whole command text blocks the notes about itself. The git guard now judges the executable text and ignores heredoc bodies and quoted strings, while still judging `bash -c "…"`.

Telemetry and evals, the two ways we know any of this is true, have their own article: [Telemetry and evals](telemetry-and-evals.md).
