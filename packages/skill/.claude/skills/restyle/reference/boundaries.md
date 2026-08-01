# Write boundary (spec §9.3, enforced here by discipline, not code)

This mirrors the `MutationGuard` that `stylesync apply --deterministic` uses
mechanically. When restyling by hand, hold yourself to the same rule: **change
only presentation.**

## Allowed
- CSS/SCSS/module files, in full.
- `class` / `className` / `:class` string literals and static template parts.
- `style` object literals and inline `style={{...}}` props.
- Tailwind config theme keys (`tailwind.config.*`, `@theme` blocks).
- Token files (`tokens.css`, `tokens.json`, `tailwind.theme.ts`).
- `styled-components` / `emotion` template literals.
- Adding `aria-*` attributes.

## Forbidden — do not touch, ever
- Function bodies, hooks, event handler bodies.
- `import` / `export` statements.
- Props passed to logic (anything that isn't purely presentational).
- `key`, `ref`, `data-testid`, `id`, `name` attributes/values.
- Routes, data fetching code, state management.
- Test files (`*.test.*`, `*.spec.*`).
- Build/deploy config (`package.json`, lockfiles, CI config, `vite.config.*`, `next.config.*`).

## If you're unsure

If a change would require touching anything in the forbidden list to achieve
the intended visual effect, **stop and say so** rather than working around it.
Flag it to the user as a case that needs a manual decision — don't silently
expand scope to make the restyle "look right."

## After every component

Before moving to the next component, verify:
- Every import in the file is unchanged.
- Every export in the file is unchanged.
- Every handler identifier (`onClick={handleSubmit}` etc.) still points at the
  same function.
- Every user-visible string (button text, labels, placeholders) is unchanged.

Any failure here means revert that file's edit and reconsider your approach —
don't patch around it.
