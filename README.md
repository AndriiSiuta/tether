# tether

A Claude Code plugin marketplace with two plugins.

**[tether](plugins/tether/README.md)** is a set of project-neutral hooks, commands and skills: a git guard for protected branches and local-only paths, an implementer report check, a fix-round cap, a spec word cap, telemetry and evals. Every project value comes from the project's `.claude/harness.json`, and a project without that file gets no behaviour.

**[tether-nx](plugins/tether-nx/README.md)** is a set of agents and skills for Angular and Nx workspaces: library layers, route-scoped providers, signals over RxJS, and an investigator, spec-writer, planner, implementer and reviewer that follow them. A project overrides any rule in its `.claude/tether-nx.md`. It works on its own or beside `tether`.

## Install

From the project directory:

```
claude plugin marketplace add <owner>/tether
claude plugin install tether@tether --scope local
claude plugin install tether-nx@tether --scope local
```

Install either plugin alone if you need only one. Each plugin's README covers its configuration.

## License

MIT; see [LICENSE](LICENSE). `plugins/tether-nx/NOTICE` lists the third-party material it includes.
