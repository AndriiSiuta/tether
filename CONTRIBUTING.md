# Contributing

Issues and pull requests are welcome. For anything that could be exploited, such as a guard bypass, follow [SECURITY.md](SECURITY.md) instead of opening an issue.

## Setup

You need Node 24, git and the Claude Code CLI.

```
git clone https://github.com/AndriiSiuta/tether.git
cd tether
npm test
claude plugin validate .
claude plugin validate plugins/tether
claude plugin validate plugins/tether-nx
```

`npm test` runs every `*.test.mjs` under `plugins/*/test/` and `test/` with `node --test`; there are no dependencies to install. The specs build every repo, home and file under a temporary directory and put fake binaries first on `PATH`, so they never touch your own config. CI runs the same commands on every push and pull request to `main`.

## Hooks: inert by default, fail open

Two rules hold for every hook in `plugins/tether/hooks/hooks.json`:

1. **Inert by default.** A hook reads its project values from `.claude/harness.json` and does nothing without that file, or without the key it needs. A new hook gets a new key, documented in the `tether` README, and no behaviour until a project sets it.
2. **Fail open.** On malformed stdin, a missing field, a malformed config or an unexpected error, a hook exits 0 with no output. Only a deliberate decision (a protected-branch commit, a denied MCP tool, a missing report field) exits 2 or denies. A hook that blocks work because it crashed is a bug; see the [threat model](docs/threat-model.md) for why that trade-off is accepted.

Every hook change comes with a spec under `plugins/tether/test/` that covers the inert case and the malformed-input case as well as the behaviour.

## Neutrality

The plugins are project-neutral. Committed files, paths and commit messages name no employer, client, product, colleague, ticket or internal path. Examples use neutral domains (orders, invoices, reports, projects) and the `@org/` npm scope.

`test/neutrality.test.mjs` checks this. Its ticket-reference and npm-scope checks always run. Its denylist check reads `.neutrality-denylist` at the repository root, one regular expression per line (`#` starts a comment), and is skipped with a visible note when the file is missing, as it is in CI. Create your own with the names you must never publish, such as your employer and its products:

```
# .neutrality-denylist
\bacme\b
acme-internal
```

The file is in `.gitignore`; never commit it, and never paste its contents into an issue or a pull request. A new npm scope in an example or a workflow goes into `ALLOWED_SCOPES` in `test/lib/neutrality.mjs` in the same commit.

## Commit style

```
type(scope): imperative summary under about 70 characters

The problem, why this approach, its shortcomings, and any context such
as a measurement.
```

`type` is one of `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `chore`; `scope` is the plugin or area (`tether`, `tether-nx`, `agents`, `neutrality`). No trailers and no tool attribution. Add a line under `Unreleased` in [CHANGELOG.md](CHANGELOG.md) for anything a user would notice.

## tether-nx rule ids

The rules live in `plugins/tether-nx/skills/angular-nx-conventions/SKILL.md`, each with an id such as `NX-4` or `DI-2`. Projects name those ids in the `overrides:` of their `.claude/tether-nx.md`, and the reviewer's table cites them, so:

- **Ids are stable.** An id never changes meaning and is never renumbered or reused.
- **To change a rule**, open a "Rule doesn't fit" issue with the id, the workspace shape where it does not fit and the override you would write. A change that keeps the rule's intent edits its wording in place. A change that alters what the rule requires gets a new id.
- **To retire a rule**, mark it deprecated in the table with the id that replaces it, if any, and keep the row; remove the reviewer row only in a later minor release.
- **To add a rule**, take the next free number in its family (`FEAT-4` after `FEAT-3`), add it to the conventions table and the reviewer's `Mode: conventions` table in the same commit, and say which guard, if any, enforces it.

## Agents and skills

Every `tether-nx` agent and skill keeps this sentence, exactly once, near the top of its body:

> Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

`test/frontmatter.test.mjs` fails without it, and it also checks names, descriptions and reference links. The plugin has eval cases under `plugins/tether-nx/evals/`; see that README's Evals section before you change an agent's output contract.

## Pull requests

Fill in the pull request template: tests, validation, the neutrality check with your own denylist, and the changelog line.
