# Per-component QA checklist

Run through this for every component before moving to the next one.

- [ ] Every colour used traces back to a token in `tokens.css` / `STYLEPACK.md` — no raw hex, no arbitrary Tailwind palette class left unmapped.
- [ ] Every spacing value is on the scale (`unit_px` multiples) — no arbitrary px values introduced.
- [ ] Radius matches one of the defined radius tokens — not a new value.
- [ ] Elevation matches the system's strategy (border vs shadow) — no mixing.
- [ ] hover state defined and visually distinct.
- [ ] active state defined.
- [ ] disabled state defined (and looks disabled — reduced opacity or equivalent).
- [ ] focus-visible state defined, using the token's focus ring recipe, and actually visible (not suppressed by `outline: none` with nothing replacing it).
- [ ] Transition duration/easing matches `motion.durations` / `motion.easings` — nothing longer than `slow`.
- [ ] `prefers-reduced-motion` fallback still applies (don't remove the global media query).
- [ ] Checked against every line in STYLEPACK.md's "Anti-patterns" section.
- [ ] No import, export, handler, id, key, ref, or test id changed.
- [ ] No user-visible copy changed.
