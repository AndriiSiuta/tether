# Bundle budgets and lazy loading

What ends up in the initial chunk, and how to keep a feature out of it.

- Every feature route lazy (`loadChildren` / `loadComponent`). The initial bundle is the shell, router, core singletons and the first screen.
- **A widget rendered by an eagerly-loaded shell or the landing screen is in the initial chunk.** Cross-feature summary widgets on a dashboard are the usual way a "lazy" feature ends up eager — check the chunk before adding one.
- `@defer` for heavy below-fold content and anything pulling a large third-party dependency (editors, charts, maps); `on viewport` / `on interaction` over `on immediate`.
- Keep budgets in `angular.json` (`initial` and `anyComponentStyle`) and read the size table on every build — a new warning is a finding, not noise.
- Root-provided services land in whichever chunk first injects them and are shared after; they are not a reason to keep a feature eager.
