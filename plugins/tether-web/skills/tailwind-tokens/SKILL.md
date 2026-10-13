---
name: tailwind-tokens
description: Use when writing or reviewing Tailwind 3 classes in an Angular template — a layout copied from a design frame, a width or height that looks fixed, a colour or spacing value the design gives in pixels, a two-column page, an icon that needs a size, an arbitrary value in square brackets — before the template is written and again at review.
---

# Tailwind tokens

Read `.claude/tether-web.md` first; where it differs from this file, it wins.

## Overview

A design frame gives pixels at one viewport; the template gives tokens and flow. A box takes its size from flex or grid, padding and margins, never from a copied number (`CON-6`). Colours and spacing come from the project's Tailwind config by name, so a theme change reaches every screen.

## The recipe

| Situation | Write | Not |
|---|---|---|
| Spacing, radius, type size, line height | A scale token: `gap-2.5`, `p-4`, `rounded-md`, `text-sm`, `leading-6` | `gap-[10px]`, `p-[16px]`, `rounded-[6px]` |
| A colour | The project's colour token by name, from `tailwind.config.js` (the rules file's `facts` may name the prefix, e.g. `ui-`): `text-ui-high-emphasis`, `bg-ui-surface`, `border-ui-outline` | a hex (`text-[#1f2937]`), a palette colour (`text-gray-800`) the config does not bind to the theme |
| A box the frame shows at 869 px | `flex-1`, `min-w-0`, `grid` tracks, padding | `w-[869px]`, `w-80`, `max-w-[869px]` |
| A card the frame shows at 240 px tall | content plus padding (`p-4`), `gap-*` between rows | `h-[240px]`, `h-60`, `min-h-[240px]` |
| A two-column frame (main and side) | `grid grid-cols-1 gap-6 xl:grid-cols-3`, main `xl:col-span-2`, side in the third column; stacks below `xl` | `flex` with `w-2/3` and `w-1/3`, or fixed column widths |
| Equal columns of cards | `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3` | `w-[calc(33%-1rem)]` |
| An image thumbnail | A fixed size is right here: `size-12 object-cover`, `h-24 w-40 object-cover` | a thumbnail that stretches with its column |
| An icon | `size-*` on the icon host: `class="flex size-5 shrink-0"`; an inline SVG inside fills it (`[&>svg]:size-full`) | `w-5 h-5` pairs, `width`/`height` attributes on the SVG |
| A value with no token | An arbitrary value (`rounded-[10px]`, `text-[28px]`) only when no token is close **and** a sibling library already uses the same value | a new arbitrary value per screen |
| A one-off style | A utility class in the template | a component `.scss` rule a utility can express |

## Before and after

```html
<!-- Before: a frame copied pixel for pixel -->
<div class="flex">
  <section class="w-[869px] h-[640px] p-[24px] bg-[#f8fafc]">…</section>
  <aside class="w-[320px] rounded-[12px] text-[#6b7280]">…</aside>
</div>

<!-- After -->
<div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
  <section class="bg-ui-surface p-6 xl:col-span-2">…</section>
  <aside class="rounded-xl text-ui-medium-emphasis">…</aside>
</div>
```

## Not this skill's job

Attribute order, self-closing tags, class sorting and control flow belong to lint and the formatter, not here.

## Before you report a task done

- `grep -nE 'w-\[|h-\[|min-w-\[|max-w-\[|\b[wh]-[0-9]+\b|#[0-9a-fA-F]{3,6}' <touched .html files>` prints only thumbnails and icons.
- Every arbitrary value left has no close token and a sibling that uses it.
- The page is checked at a width below `xl`: the columns stack, nothing scrolls sideways.

## Common mistakes

- `w-80` because "it is a token". A width token on a layout box is still a fixed width.
- `min-h-[…]` to make two cards match; a `grid` row already stretches them.
- A colour picked by eye from the palette instead of the token the design system names.
