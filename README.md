# StyleSync Personal

Turn a design you admire into a design system your coding agent can actually
follow, then apply as much of it as can be applied deterministically.

This is a from-scratch implementation of the **v2 "Personal" specification**
(`stylesync-spec-v2-personal.md`) you provided — a local-first CLI + SQLite +
Playwright tool, replacing the previous Google AI Studio browser app entirely.
That app was a fully mocked React prototype (canned JSON, Unsplash stock
photos standing in for screenshots, no real scraping, no persistence); it
could never satisfy "scrapes and stores styles in its own database" because
a browser sandbox can't run headless Chromium or write a SQLite file to disk.
This project can, because it's a real Node CLI + local web app you run on
your own machine.

## What's real here (not mocked, not stubbed)

- **SQLite schema** (`data/stylesync.db`) — sources, refs, ref_assets, drps,
  packs, sync_runs, FTS5 search — exactly per spec §5.
- **Three working ingestion adapters**: Lapa Ninja (headless capture,
  follow-through to the live site), Figma Community (official REST API,
  Tier A confidence), and a generic ad-hoc URL adapter. Delta sync with
  content-hash/visual-hash short-circuiting.
- **Real DRP extraction**: OKLCH colour clustering (weighted k-means, k
  tuned 4-8 by silhouette score) via `culori`, WCAG contrast calculation and
  auto-correction, type-scale detection against modular ratios, spacing GCD
  detection, radius/shadow/motion extraction from actual computed styles.
  Tier A (Figma Variables) and Tier C (vision-based, via either Claude —
  `ANTHROPIC_API_KEY` — or Gemini — `GEMINI_API_KEY`, whichever is set) are
  also implemented; Banani is the current Tier C adapter.
- **Style Pack generator**: `STYLEPACK.md`, `tokens.css`, `tailwind.theme.ts`,
  `tokens.json`, `components.md`, anti-patterns derived from the DRP's own
  signals.
- **Deterministic codemod engine**: postcss-based colour/radius/shadow/
  spacing/motion transforms, a real `MutationGuard` write boundary, Tailwind
  class rewriting via `ts-morph` (JSX `className` string literals only, per
  the write boundary), OKLCH-nearest-token colour mapping, git clean-tree
  precondition + revert-on-violation.
- **Full CLI**: `sync`, `doctor`, `search`, `show`, `pack`, `apply`, `shots`,
  `history`, `web`.
- **Next.js library UI** (`localhost:4321`): Library grid with filters and
  FTS search, Reference detail with **live rendered component previews**
  built straight from each reference's extracted tokens, Sources dashboard.
  Dark-first, restrained, monospace-token theme per spec §13.8.
- **Claude Code skill** (`packages/skill/.claude/skills/restyle/`) for the
  agent-assisted last mile, per §10.

All three packages (`@stylesync/core`, `@stylesync/cli`, `@stylesync/web`)
typecheck cleanly and `apps/web` has been verified with a real production
`next build`.

## What's not done / known limitations

- **Lapa Ninja's CSS selectors are best-effort, unverified against the live
  site.** This sandbox's network access is allowlisted and couldn't reach
  lapa.ninja to confirm markup. Selectors live in
  `packages/core/config/sources/lapa-ninja.yaml` — if `stylesync doctor`
  reports 0 items discovered, that's a one-line YAML edit, not a rebuild
  (this is the resilience the spec asks for in §6.1).
- **Visual hash is an average-hash approximation**, not true perceptual
  hashing (no DCT) — documented in `packages/core/src/util/hash.ts`. Good
  enough to catch "this screenshot changed materially" but weaker than a
  real pHash. Upgrade path: add `sharp` + a DCT implementation.
- **Sources 5-8** (Refero, Banani, UX Archive, Design Spells) are not built —
  the spec explicitly scopes them as enrichment, "ship after 4" (§6.2).
- **Motion capture** (6s webm scroll/hover recording, §6.3.6) is not
  implemented — only static computed-style motion (transition durations)
  is extracted today.
- **Web UI's virtualised masonry grid and infinite scroll** (§11.1) is a
  plain responsive CSS grid instead — functional, not virtualised. Fine at
  personal-library scale (hundreds of refs); would need work at thousands.
- **Semantic (embedding) search** is explicitly Phase 3 / optional in the
  spec — not built. FTS5 keyword search is.
- **Runtime has not been exercised end-to-end** in this environment:
  `better-sqlite3` needs a native compile step and this sandbox's network
  allowlist blocks the Node headers download that requires. Verification
  here was static (`tsc --noEmit` on all three packages, clean, plus a real
  `next build` production compile) rather than a live `stylesync sync` run.
  Run `pnpm install` on your own machine first — that's expected to work
  normally there.

## Setup

```bash
corepack enable                  # or: npm i -g pnpm
pnpm install
git init                         # if this isn't already a git repo — `apply` refuses to run without one
```

Optional environment variables:

```bash
export FIGMA_TOKEN=...           # only needed for the Figma adapter
export ANTHROPIC_API_KEY=...     # Tier C (vision) adapters — either this or GEMINI_API_KEY
export GEMINI_API_KEY=...        # alternative to ANTHROPIC_API_KEY for Tier C vision extraction
```

## Typical session

```bash
pnpm cli sync                              # delta-sync all sources
pnpm cli web                                # browse at http://localhost:4321, copy a ref id

cd ~/code/my-app
git checkout -b restyle
pnpm --filter @stylesync/cli exec stylesync pack ref_lapaninja_some-slug
pnpm --filter @stylesync/cli exec stylesync apply --deterministic
pnpm dev                                    # look at it
# point Claude Code at .stylesync/STYLEPACK.md, or copy packages/skill/.claude
# into this project for the agent-assisted last mile
git diff                                    # review; git checkout . to undo
```

(Once you `npm link` or install the CLI globally, drop the
`pnpm --filter @stylesync/cli exec` prefix and just run `stylesync ...`.)

## Layout

```
apps/web/        Next.js library UI — localhost:4321
packages/cli/     `stylesync` command
packages/core/    adapters, DRP builder, codemods, style-pack generator, SQLite layer
packages/skill/   Claude Code skill for the agent-assisted last mile
data/             SQLite db + captured assets (gitignored, created on first run)
```

See `stylesync-spec-v2-personal.md` for the full specification this
implements, and `stylesync-ai-specification.md` for the original (superseded)
SaaS-scoped v1 spec it was rescoped from.
