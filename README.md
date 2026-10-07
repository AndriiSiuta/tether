# tether

[![CI](https://github.com/AndriiSiuta/tether/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AndriiSiuta/tether/actions/workflows/ci.yml)

A Claude Code plugin marketplace with two plugins.

**[tether](plugins/tether/README.md)** is a set of project-neutral hooks, commands and skills: a git guard for protected branches and local-only paths, an implementer report check, a fix-round cap, a spec word cap, telemetry and evals. Every project value comes from the project's `.claude/harness.json`, and a project without that file gets no behaviour.

**[tether-nx](plugins/tether-nx/README.md)** is a set of agents and skills for Angular and Nx workspaces: library layers, route-scoped providers, signals over RxJS, and an investigator, spec-writer, planner, implementer and reviewer that follow them. A project overrides any rule in its `.claude/tether-nx.md`. It works on its own or beside `tether`.

## Install

From the project directory:

```
claude plugin marketplace add AndriiSiuta/tether#v0.2.0
claude plugin install tether@tether --scope local
claude plugin install tether-nx@tether --scope local
```

Install either plugin alone if you need only one. Each plugin's README covers its configuration. Requirements: Claude Code with plugin support, Node 24 and git; the optional parts (telemetry, metrics, backup) list their own tools in the tether README.

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
| `tether` | 0.2.0 | Used daily on a production Angular/Nx monorepo; 200+ tests. |
| `tether-nx` | 0.1.0 | Early. The rules and agents come from that same workspace, but the plugin agents have not yet been verified on other repositories. Expect wording changes; rule ids are stable. |

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Security

Report a vulnerability privately, as [SECURITY.md](SECURITY.md) describes. [docs/threat-model.md](docs/threat-model.md) lists the inputs the plugins guard against, the hook or command that covers each, and the residual risks.

## License

MIT; see [LICENSE](LICENSE). `plugins/tether-nx/NOTICE` lists the third-party material it includes.
