# Security policy

## Supported versions

| Plugin | Supported |
|---|---|
| `tether` | 0.2.x |
| `tether-nx` | 0.1.x |

Older versions get no fixes. Update with `claude plugin marketplace update tether` and then `claude plugin update <plugin>@tether`.

## Reporting a vulnerability

Report privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** (private vulnerability reporting, which creates a draft security advisory only the maintainer can see). Please do not open a public issue, pull request or discussion for anything exploitable.

Include the plugin and version, the Claude Code version, your OS, the `.claude/harness.json` or `.claude/tether-nx.md` involved (with project values replaced), and the smallest tool call or command that shows the problem.

## What counts

- **Guard bypass:** a `git commit` or `git push` on a protected branch, or one carrying a local-only path, that `git-guard` lets through; an MCP write tool listed in `mcpWriteDeny` that `mcp-write-guard` does not deny.
- **A hook that fails closed:** a hook that blocks ordinary work (exits 2 or denies) on malformed input, a missing config or an unrelated tool call. Hooks are meant to fail open; see [CONTRIBUTING.md](CONTRIBUTING.md).
- **Secret or environment leakage:** a hook, command or script that prints a token, a credential or an environment variable value to the terminal, a transcript or a file.
- **Telemetry exposure:** anything that makes the local telemetry stack reachable beyond `127.0.0.1`, or that logs prompt, response or tool content when setup says those switches are off.

Known limits that are by design, such as hooks failing open or the git guard reading command text, are listed in the [threat model](docs/threat-model.md). A report that shows one of them doing more harm than that page says is still welcome.

## What to expect

This is a small project maintained by one person in spare time. I aim to acknowledge a report within a week and to agree a fix and disclosure date with you after that. There is no bug bounty. Credit in the advisory and the changelog is yours if you want it.
