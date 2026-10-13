# tether

[![CI](https://github.com/AndriiSiuta/tether/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AndriiSiuta/tether/actions/workflows/ci.yml)

A Claude Code plugin marketplace with three plugins.

**[tether](plugins/tether/README.md)** is a set of project-neutral hooks, commands and skills: a git guard for protected branches and local-only paths, an implementer report check, a fix-round cap, a spec word cap, telemetry and evals. Every project value comes from the project's `.claude/harness.json`, and a project without that file gets no behaviour.

**[tether-nx](plugins/tether-nx/README.md)** is a set of rules for Angular and Nx workspaces: library layers, route-scoped providers, signals over RxJS, SignalStore, PrimeNG, performance and accessibility. A project overrides any rule in its `.claude/tether-nx.md`. It is skills only; the agents that apply the rules live in `tether-web`.

**[tether-web](plugins/tether-web/README.md)** is the workflow for a web front end: an investigator, spec-writer, planner, plan-validator, two implementers, a conventions reviewer, a code reviewer, a ui-checker and a pr-creator, plus the process skills they preload. A project sets its tracker, pull-request host, preview URL, verify command and paths in `.claude/tether-web.md`. It depends on `tether-nx` and on the `nx` plugin from the `nx-claude-plugins` marketplace.

## Install

From the project directory:

```
claude plugin marketplace add AndriiSiuta/tether#v0.4.4
claude plugin install tether@tether --scope local
claude plugin install tether-nx@tether --scope local
claude plugin install tether-web@tether --scope local
```

`tether` and `tether-nx` each work alone; `tether-web` needs `tether-nx` and the `nx` plugin from the `nx-claude-plugins` marketplace beside it. Each plugin's README covers its configuration. Requirements: Claude Code with plugin support, Node 24 and git; the optional parts (telemetry, metrics, backup) list their own tools in the tether README.

**Platforms:** tested on Linux; macOS and Windows are untested. The hooks need Node 24, the Prettier hook also needs `python3`, and telemetry needs Docker.

## Context cost

Estimates from `claude plugin details`; the real figure depends on the Claude Code version and the model's tokenizer.

| Plugin | Always loaded | On invoke |
|---|---|---|
| `tether` | ≈ 400 tokens | 150 to 1.2k per command or skill |
| `tether-nx` | ≈ 1.7k tokens | from ≈ 840 (`investigator`) to ≈ 5.8k (`angular-architecture`) |

"Always loaded" is the plugin's command, skill and agent descriptions, present in every session; "on invoke" is what one command, skill or agent adds when it runs.

## Status

| Plugin | Version | Maturity |
|---|---|---|
| `tether` | 0.4.4 | Used daily on a production Angular/Nx monorepo; 260+ tests. |
| `tether-nx` | 0.3.1 | Rules only. The rules come from that same workspace; expect wording changes; rule ids are stable. |
| `tether-web` | 0.2.0 | Early. The agents that plan, implement, review, check the UI and open the pull request; not yet verified on other repositories. Expect wording and report-format changes. |

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

Two short articles explain the why: [A harness for Claude Code](docs/articles/a-harness-for-claude-code.md) (memory, guard rails and the score) and [Telemetry and evals](docs/articles/telemetry-and-evals.md) (how we know it works).

## Security

Report a vulnerability privately, as [SECURITY.md](SECURITY.md) describes. [docs/threat-model.md](docs/threat-model.md) lists the inputs the plugins guard against, the hook or command that covers each, and the residual risks.

## License

MIT; see [LICENSE](LICENSE). `plugins/tether-nx/NOTICE` lists the third-party material it includes.
