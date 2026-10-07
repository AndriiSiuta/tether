# Guards

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

Three rules are cheap to break and expensive to find in review, so each gets an automated check that runs with the unit tests or the lint step. Where a workspace lacks one, the outline below is enough to build it. Each guard reads the workspace, not a hand-written list, so a new library is covered the day it is generated.

## `GUARD-1`: library shape

Enforces `FEAT-1` and `FEAT-2` (and `NX-6` for the shell).

**Fails on:**

- a technical folder (`components/`, `services/`, `models/`, `store/`) or an FSD segment (`ui/`, `model/`, `api/`, `pages/`, `widgets/`, `features/`, `entities/`) directly under a feature or shell library's `src/lib/`;
- a top-level folder in a data-access library outside `store/ services/ models/ consts/ utils/`;
- an FSD segment at the top level of a ui or util library.

**Outline:** a Jest or `node:test` spec that reads every `project.json` under `libs/`, takes the `type:` tag, lists the directories directly under `src/lib/`, and compares them with an allowed or forbidden set per type. The failure message names the library, the folder and the rule id. Testing libraries are exempt.

## `GUARD-2`: boundary lint

Enforces `NX-2` and `NX-4`, reads the `NX-1` tags, and catches `FEAT-3`.

**Fails on:**

- an import that points up a layer (data-access → ui, ui → feature, anything → app);
- an import of a feature or shell library from another scope;
- a feature importing a feature;
- a non-spec file importing a testing library;
- an import by a relative or absolute path into another library's `src/`, instead of its alias;
- a circular dependency between projects.

**Outline:** the `@nx/enforce-module-boundaries` ESLint rule in a dedicated config that runs over `apps/` and `libs/`, with a `depConstraints` table:

| Source tag | May depend on |
|---|---|
| `type:app` | `type:shell`, `type:feature` (lazy), `type:ui`, `type:data-access`, `type:util` |
| `type:shell` | `type:feature` (lazy), `type:ui`, `type:data-access`, `type:util` |
| `type:feature` | `type:ui`, `type:data-access`, `type:util` |
| `type:ui` | `type:ui`, `type:data-access`, `type:util` |
| `type:data-access` | `type:data-access`, `type:util` |
| `type:util` | `type:util` |
| `type:testing` | `type:testing`, `type:data-access`, `type:util` |

The table is for production files. Specs get one override: a second config block whose `files` are `**/*.spec.ts` (and the test setup files) repeats the table with `type:testing` added to every row, so a spec may import a testing library while production code may not (`NX-2`).

Scope privacy is a second set of rows: a library tagged `scope:orders` and `type:feature` may be depended on only by `scope:orders` or the shell. Keep `allow` and any ignored cycle empty; an exception is a rule-file override, not a lint config edit. Run it as its own script so the CI step fails on a finding even when the general lint is not gated.

## `GUARD-3`: provider census

Enforces `DI-1`, and keeps `DI-2` honest.

**Fails on:** a class decorated with a bare `@Injectable()` (no `providedIn`) that appears in no `providers` array anywhere in the workspace, which would fail at runtime the first time it is injected.

**Outline:** a spec that walks every `.ts` file under `apps/` and `libs/` (skipping specs), collects the class names that follow a bare `@Injectable()`, collects every identifier inside a `providers:` array literal and inside each exported `<domain>Providers` array, and reports the classes missing from the second set with their file paths. A regex pass is enough; a TypeScript AST pass is sturdier when providers are spread from other arrays. An allowlist of classes provided by a factory may exist, each entry with the reason beside it.
