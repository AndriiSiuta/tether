---
name: ng-primeng
description: Use when a screen uses PrimeNG components (`primeng/*`, `p-table`, `p-dialog`, `p-select`, `providePrimeNG`) — importing a component, a large or server-paged table, theming with the Aura or Lara presets and design tokens — or when reviewing PrimeNG usage. Not for Angular Material, Spartan or another component library.
license: MIT
metadata:
  author: alfredoperez
  version: "1.2.0"
---

# Angular PrimeNG Best Practices

Read `.claude/tether-nx.md` first; where it differs from this file, it wins.

PrimeNG rules for component imports, table performance, and theming. The incorrect and correct example for each rule is in [AGENTS.md](AGENTS.md).

## When to Apply

- Importing PrimeNG standalone components
- Configuring tables with server-side pagination or virtual scrolling
- Setting up Aura/Lara themes with design tokens

## Rules

| Rule | Impact | Description |
|------|--------|-------------|
| Tree-Shake PrimeNG Imports | MEDIUM | Standalone component imports for smaller bundles |
| Use PrimeNG Table with Lazy Loading | HIGH | Server-side pagination for large datasets |
| Use PrimeNG Theme System | MEDIUM | Design tokens via providePrimeNG instead of CSS overrides |
