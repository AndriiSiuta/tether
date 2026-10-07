## What and why

<!-- The problem, the approach, and its shortcomings. -->

## Checklist

- [ ] `npm test` passes (fail 0).
- [ ] `claude plugin validate .`, `claude plugin validate plugins/tether` and `claude plugin validate plugins/tether-nx` pass.
- [ ] The neutrality test passes with my own `.neutrality-denylist` (see CONTRIBUTING.md); no employer, client, product, colleague, ticket or internal path is named.
- [ ] A changed hook keeps the inert-by-default and fail-open rules, with specs for both.
- [ ] A changed `tether-nx` rule keeps its id; a retired one is deprecated, not renumbered.
- [ ] One line under `Unreleased` in CHANGELOG.md, or none needed because no user would notice.
