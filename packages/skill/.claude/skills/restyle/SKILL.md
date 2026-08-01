---
name: restyle
description: Applies a StyleSync Style Pack (.stylesync/STYLEPACK.md) to the current project, one component at a time. Triggers on requests to restyle, re-skin, or apply a design system when .stylesync/STYLEPACK.md exists in the project.
---

# StyleSync restyle skill

This is the "last mile" step in the StyleSync pipeline (spec §10): the ~30%
of a restyle that deterministic codemods can't do — component recipe
alignment, layout adoption, structural polish — handled by you, working
inside the actual project with its actual dev server, rather than by a
server-side pipeline.

## When this triggers

The user asks to restyle, re-skin, reskin, "make this look like X", or apply
a design system, **and** `.stylesync/STYLEPACK.md` exists in the current
project. If it doesn't exist, tell the user to run `stylesync pack <ref_id>`
first — don't improvise tokens.

## Procedure

1. **Read the brief.** Read `.stylesync/STYLEPACK.md` in full, then
   `.stylesync/components.md`. These are prompts, not documentation — the
   rules in STYLEPACK.md are binding, not suggestions.

2. **Read the write boundary.** Read `reference/boundaries.md` in this skill
   folder before touching anything. It is the same MutationGuard contract
   `stylesync apply --deterministic` enforces mechanically — you are
   expected to enforce it yourself since there's no guard wrapping your edits.

3. **Inventory components.** Walk the project's component tree and classify
   each UI element into a role from the closed vocabulary in Appendix B of
   the spec (`action.button.primary`, `display.card`, `input.text`, etc. —
   the full list is in `reference/role-vocabulary.md`). Skip anything you
   can't confidently classify rather than guessing.

4. **Work one component at a time.** Never restyle the whole project in one
   pass. For each component:
   - Apply the recipe for its role from `components.md` (exact values —
     colours, radius, padding, font — never approximate or invent a value).
   - Add all four interaction states: hover, active, focus-visible, disabled.
   - Apply the focus ring exactly as specified in STYLEPACK.md rule 6.
   - Check the component against every rule in the "Anti-patterns" section
     of STYLEPACK.md before moving on.
   - Re-read `reference/checklist.md` and confirm every line before moving
     to the next component.

5. **Never touch logic.** If a component's styling is entangled with a
   conditional class computed from state/props, restyle only the class
   string literal, never the condition or the state itself. If you can't
   separate presentation from logic safely, stop and tell the user rather
   than guessing.

6. **At the end:** run the project's build command and, if a dev server is
   already running, run `stylesync shots` to capture before/after
   screenshots. Report which components you restyled, which you skipped and
   why, and point the user at `git diff` to review.

## Composition with impeccable

If the `impeccable` skill/tool is available, it slots in right after step 6
as a post-restyle critique pass — run it, feed its findings back as a second
pass over the specific components it flags. Extraction (StyleSync) →
application (this skill) → critique (impeccable) is the intended closed loop
per spec §10.
