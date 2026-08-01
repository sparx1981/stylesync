# StyleSync — Personal Edition

**Version:** 2.0 (supersedes v1.0)
**Context:** Single-user, local-first tool. Runs on your machine. Never deployed publicly, no other users, no untrusted input.
**Audience:** AI coding agents (Claude Code, Claude, Gemini / Google AI Studio) building this, and you reviewing their output.

---

## 0. What changed from v1, and why

v1 was specified as a SaaS product. Roughly 40% of it existed solely to handle other people's code, other people's data, and public exposure. Removing that isn't a downgrade — it's the difference between a six-month build and a two-week build.

| v1 (SaaS) | v2 (Personal) | Why |
|---|---|---|
| Postgres + Redis + S3 + pgvector | **SQLite + local filesystem** | One user, thousands of records not millions. SQLite FTS5 handles search fine |
| Auth, tenancy, rate limiting, billing | **None** | It's your laptop |
| Firecracker/gVisor sandboxes, no egress, seccomp | **Your own dev server** | The code being restyled is yours. There's nothing to defend against |
| ZIP upload, extraction, zip-bomb guards, secret scanning | **Point at a folder path** | `stylesync ./my-project`. No archive step at all |
| Behaviour-preservation assertions as the safety net | **Git branch + `git diff`** | You already have the best rollback mechanism ever built. Use it |
| BullMQ job queue, SSE progress, retries, idempotency keys | **In-process async with a progress log** | One job at a time is fine |
| Framework Transformation mode (Vue→React etc.) | **Cut from v1 scope** | Enormous build cost. You control your own stacks; you don't need a transpiler |
| Full compliance layer, takedown workflow, legal review | **A short politeness policy** (§3) | Private local cache for personal reference |
| Golden corpus of 12 projects, CI regression matrix | **3 projects, run manually** | Right-sized for a solo tool |

**And one thing got bigger:** the *Style Pack* (§8). Since you already vibe code with AI agents, the highest-leverage output isn't a restyled codebase — it's a precise, portable design-system brief that you hand to the agent you're already using. That reframes the whole product and is the single most important change in v2.

---

## 1. Reframed product

### 1.1 The actual problem

You generate a lot of working-but-generic-looking apps. The bottleneck isn't code, it's *design direction that an AI agent can execute against*. "Make it look nicer" produces slop. "Use these exact 68 tokens, these component recipes, this spacing rhythm, this motion signature" produces something coherent.

### 1.2 The product, restated

StyleSync turns a design you admire into **a design system your coding agent can actually follow**, then applies as much of it as can be applied deterministically.

Three layers of output, in increasing ambition:

1. **Style Pack** *(highest value, lowest cost)* — a portable folder containing `tokens.css`, `tailwind.theme.ts`, `STYLEPACK.md` (the design brief in agent-readable prose + rules), and component recipes. Drop it into any project, point Claude Code at it, done.
2. **Deterministic restyle** *(safe, no LLM cost)* — codemods that swap colours, fonts, radii, spacing, and shadows to the reference's tokens. Reversible via git. Handles ~60–70% of the visual delta with zero risk of breaking logic.
3. **Agent-assisted restyle** *(the last mile)* — component-by-component restyling of the tricky parts, run as a Claude Code skill inside your project rather than as a server-side pipeline.

Build them in that order. Layer 1 alone may be enough that you never build layer 3.

### 1.3 Non-goals (v2, hard)

- No framework transformation. No Vue→React.
- No hosting, no accounts, no sharing, no public library.
- No canvas or design editing.
- No restyling of code you didn't write.

---

## 2. Form factor

Three surfaces, one codebase:

```
stylesync/
├── apps/web/        Next.js app on localhost:4321 — the Library (browsing is inherently visual)
├── packages/cli/    `stylesync` command — sync, extract, pack, apply
├── packages/core/   adapters, DRP builder, codemods, style-pack generator
├── packages/skill/  Claude Code skill for the agent-assisted last mile
└── data/            SQLite db + captured assets (gitignored)
```

**Why both a web app and a CLI:** you cannot browse 2,000 design references in a terminal — the library needs a GUI. But you also don't want to upload a ZIP of a project sitting on the same disk. So: browse in the browser, act from the terminal in the project directory.

**Typical session:**

```bash
# once in a while
stylesync sync                          # delta-sync all sources
open http://localhost:4321              # browse, find something, hit "Copy ref id"

# in the project you're working on
cd ~/code/my-app
git checkout -b restyle
stylesync pack ref_lapa_4821            # writes .stylesync/ into the project
stylesync apply --deterministic         # codemods: colours, fonts, radii, spacing
pnpm dev                                # look at it
claude "restyle the dashboard components using .stylesync/STYLEPACK.md"
git diff                                # review; git checkout . to undo
```

That flow is the product. Everything below serves it.

---

## 3. Ingestion politeness (short version)

Not a compliance regime — just the practical rules that keep the crawler working and the cache honest.

- **Use official APIs where they exist.** Figma has a REST API with OAuth; use it. Never scrape Figma.
- **Crawl slowly.** Default 6 requests/minute per source, one worker per source, honour `robots.txt` and `Retry-After`. This is self-interest: a hammered source blocks your IP and your library stops working.
- **Cache is private.** Captured DOM/CSS/screenshots live in `data/` on your disk, for your own reference. They are the raw material the token extractor reads.
- **Emit derived values, not assets.** What lands in your projects is tokens, scales, and recipes — not someone else's markup, logos, photography, or icon sets. Fonts are the exception: emit the font *reference* (Google Fonts / `next/font`), which is what the licence is for.
- **Idempotent and resumable.** Sync can be interrupted at any point and re-run without duplicating work.

---

## 4. Technical stack

| Layer | Choice | Note |
|---|---|---|
| Runtime | Node 22, TypeScript, pnpm workspaces | |
| Web UI | Next.js 15 App Router, Tailwind v4, shadcn/ui | Localhost only. Dogfood: the app's own theme is generated by its own extractor |
| CLI | `commander` + `@clack/prompts` | Interactive where it helps, flags where it doesn't |
| DB | **SQLite** via `better-sqlite3`, FTS5 for search | Single file at `data/stylesync.db`. Zero ops |
| Semantic search | `sqlite-vec` + local embeddings (`Xenova/all-MiniLM-L6-v2` via transformers.js) | Optional, Phase 3. Tag filters cover most of it |
| Crawling | Playwright (Chromium) | Already familiar to you |
| CSS analysis | `postcss`, `culori` (OKLCH colour maths) | `culori` matters — do colour work in OKLCH, not hex |
| Code parsing | `ts-morph` (TS/JS/JSX), `@vue/compiler-sfc`, `parse5` | |
| Codemods | `jscodeshift` + custom postcss plugins | |
| LLM | Claude via `@anthropic-ai/sdk`, provider-agnostic interface | Only used for vision extraction and the last-mile skill |
| Assets | Plain filesystem under `data/refs/` | No object store |

**Deliberately absent:** Redis, Postgres, Docker, message queues, S3, auth libraries, Firestore. If an agent proposes adding any of these, reject it.

---

## 5. Data model (SQLite)

```sql
create table sources (
  id                text primary key,        -- 'lapa-ninja', 'figma', ...
  display_name      text not null,
  category          text not null,           -- flows | web | vector | motion
  access_method     text not null,           -- api | sitemap | headless
  base_url          text not null,
  rpm               integer not null default 6,
  enabled           integer not null default 1,
  last_sync_at      text,
  health            text                     -- json: {ok, message, checked_at}
);

create table refs (
  id             text primary key,           -- 'ref_lapa_4821' — human-typeable, used in CLI
  source_id      text not null references sources(id),
  external_id    text not null,
  origin_url     text not null,
  title          text,
  creator_credit text,
  captured_at    text not null,
  last_synced_at text not null,
  content_hash   text not null,
  visual_hash    text,
  status         text not null default 'ready',   -- ready | partial | failed
  tags           text,                            -- json array
  favorite       integer not null default 0,
  used_count     integer not null default 0,      -- how often you've packed it
  unique (source_id, external_id)
);

create table ref_assets (
  ref_id      text not null references refs(id) on delete cascade,
  kind        text not null,   -- screenshot | thumb | dom | css | video | figma_node | flow
  path        text not null,   -- relative to data/
  bytes       integer,
  meta        text,            -- json
  primary key (ref_id, kind, path)
);

create table drps (
  ref_id     text primary key references refs(id) on delete cascade,
  version    integer not null default 1,
  profile    text not null,     -- the DRP json, §7
  confidence real not null,
  method     text not null,     -- computed_css | figma_api | vision_inferred
  built_at   text not null
);

create table packs (                     -- history of what you applied where
  id          text primary key,
  ref_id      text not null references refs(id),
  project_path text not null,
  created_at  text not null,
  applied     text                       -- json: {deterministic: [...files], notes}
);

create table sync_runs (
  id text primary key, source_id text, trigger text,
  started_at text, finished_at text,
  discovered integer, added integer, updated integer, unchanged integer, failed integer,
  log_path text
);

create virtual table refs_fts using fts5(
  id unindexed, title, tags, descriptors, content='refs'
);
```

Filesystem:

```
data/
├── stylesync.db
└── refs/{source_id}/{external_id}/
    ├── screenshot.webp
    ├── thumb.webp
    ├── dom.json
    ├── computed-styles.json
    ├── styles.css
    ├── motion.webm          # motion sources only
    └── figma-node.json      # figma only
```

---

## 6. Ingestion

### 6.1 Adapter interface (unchanged from v1 — it was right)

```ts
export interface SourceAdapter {
  readonly id: string;
  readonly category: 'flows' | 'web' | 'vector' | 'motion';
  readonly rpm: number;

  discover(ctx: CrawlContext): AsyncIterable<DiscoveredItem>;
  signature(item: DiscoveredItem, ctx: CrawlContext): Promise<string>;
  capture(item: DiscoveredItem, ctx: CrawlContext): Promise<RawCapture>;
  health(ctx: CrawlContext): Promise<HealthReport>;
}
```

Source-specific logic lives *only* in adapters. Selectors live in `config/sources/*.yaml`, not in code, so a broken site is a config edit rather than a rebuild.

### 6.2 Build order (this matters — don't do all eight at once)

| Priority | Source | Why this order |
|---|---|---|
| **1** | **Lapa Ninja** | Links to *live landing pages*. Real computed CSS = real tokens. Highest-fidelity non-Figma source, and landing-page aesthetics transfer well to app UI |
| **2** | **Figma Community** | Official API, authoritative variables/styles. Confidence ~1.0. No scraping at all |
| **3** | **SaaS Pages / Interface Index** | Actual application UI — dashboards, settings, tables, empty states. Closest to what you build |
| **4** | **Godly** | High-end web + motion. Capture a scroll video to derive easing curves |
| 5 | Refero.design | Good component taxonomy; use its labels to seed the role vocabulary |
| 6 | Banani | Screenshot-only → vision extraction. Lower confidence |
| 7 | UX Archive | Flow taxonomy; useful for structure, weak for tokens |
| 8 | Design Spells | Motion signatures only. Small but high-delight |

Sources 1–4 give you a genuinely useful library. Sources 5–8 are enrichment. **Ship after 4.**

### 6.3 Capture routine

For headless sources, per item:

1. Viewports: `1440×900` DPR 2, plus `390×844` for mobile-oriented sources.
2. Block trackers; allow fonts and images.
3. Wait for network idle + `document.fonts.ready` + 500 ms.
4. Capture: full-page WebP screenshot (q82), serialised DOM, sampled `getComputedStyle`, all stylesheet text, `@font-face` list, and the `:root` custom-property table.
5. **Computed-style sampling:** every element is wasteful. Take (a) one element per distinct `tag+class` signature, capped at 1,500, plus (b) everything matching button/input/card/heading/nav/table heuristics.
6. Motion sources: 6 s webm at 30 fps while a script scrolls and hovers interactive elements.
7. For Lapa Ninja and Godly, **follow through to the live site** — the gallery screenshot is not the source of truth, the live CSS is.

### 6.4 Delta sync

- `content_hash` = sha256 of canonicalised capture (volatile attributes stripped, computed styles sorted, text normalised).
- `visual_hash` = pHash of the screenshot, catching visual change where the DOM is dynamic.
- Full capture only when `signature()` differs or `last_synced_at` exceeds the source's max age. If both hashes match afterwards, discard the new blobs and bump the timestamp.
- `stylesync sync` = delta, all enabled sources. `stylesync sync --source lapa-ninja --full` = backfill.
- Degrade, don't fail: if a selector breaks, keep the screenshot, mark `status='partial'`, surface it in `stylesync doctor`.

---

## 7. Design Reference Profile (the core contract)

Unchanged in shape from v1 — it was the right idea and it survives the rescope intact. Full JSON schema is in **Appendix A**. The essentials:

The DRP is the normalised design system extracted from a reference. **Nothing downstream ever reads a raw capture.** It carries: colour palette with semantic role assignments and full OKLCH ramps, type scale with measured line-heights, spacing unit and scale, radii, elevation recipes, motion durations/easings/signatures, layout characteristics, per-role component recipes with states, and provenance + confidence.

### 7.1 Extraction tiers

| Tier | Method | Sources | Confidence |
|---|---|---|---|
| **A — Authoritative** | Figma Variables/Styles API | Figma | 0.95–1.0 |
| **B — Measured** | Computed CSS from the live site, clustered | Lapa Ninja, Godly, SaaS Pages | 0.75–0.95 |
| **C — Inferred** | Vision model over screenshots + palette quantisation | Banani, UX Archive, Refero, Design Spells | 0.45–0.75 |

### 7.2 Tier B extraction algorithm (specify precisely — agents fumble this)

1. Collect every computed `color`, `background-color`, `border-color`, weighted by rendered pixel area.
2. Convert to **OKLCH**. Cluster with k-means, k tuned 4–8 by silhouette score.
3. Assign roles: largest-area low-chroma cluster → `neutral`/canvas; highest-chroma cluster appearing on interactive elements → `primary`; clusters on elements matching success/warning/error heuristics → semantic.
4. Generate a 50–950 ramp per cluster by interpolating lightness in OKLCH, holding hue, scaling chroma along a perceptual curve. **Do not interpolate in sRGB — it produces muddy mid-tones.**
5. Type scale: collect `font-size` frequencies, snap to the nearest modular ratio (1.125 / 1.2 / 1.25 / 1.333 / 1.5), keep the *measured* line-heights rather than deriving them.
6. Spacing: collect margins/paddings/gaps, find the GCD within ±1px tolerance → `unit_px`, then the observed scale.
7. Radii and shadows: mode of measured values per component class.
8. `confidence` = mean cluster silhouette × sampled-element coverage.

### 7.3 Quality gate

Publish a DRP only if it has ≥3 palette roles, ≥4 type steps, a spacing unit, and passes WCAG AA contrast for `fg.default` on `bg.canvas`. **If contrast fails, auto-correct lightness and set `contrast_adjusted: true`** — never propagate an inaccessible palette into your projects. Failures go to `stylesync doctor` for manual repair.

---

## 8. The Style Pack — the primary output

**This is the highest-leverage part of the whole tool.** It is the artefact that makes your existing coding agents good at design.

`stylesync pack ref_lapa_4821` writes into the current project:

```
.stylesync/
├── STYLEPACK.md          # the agent-readable design brief — the important file
├── tokens.css            # :root custom properties, light + dark
├── tailwind.theme.ts     # theme.extend (v3) or @theme block (v4)
├── tokens.json           # W3C Design Tokens format, for anything else
├── components.md         # per-role recipes with exact values and states
├── reference/
│   ├── screenshot.webp   # what you're aiming at
│   └── source.txt        # origin url + creator credit
└── pack.json             # ref id, drp version, confidence, generated_at
```

### 8.1 STYLEPACK.md structure

This file is a **prompt**, not documentation. Write it accordingly:

```markdown
# Design System: {identity.name}

## How to use this file
You are restyling an existing application. Apply the system below.
Change only presentation. Never change logic, data flow, props, handlers,
routes, copy, or test ids. Use only the tokens defined here — never invent
a colour, size, radius, or font.

## Aesthetic direction
{2–3 sentences of plain-language character: "Dark, data-dense, geometric.
Flat surfaces separated by hairline borders rather than shadows. Tight
vertical rhythm. Colour used sparingly and only for state and action."}

## Rules (in priority order)
1. Every colour comes from the token table. No raw hex.
2. Every spacing value is a multiple of {unit}px, from the scale below.
3. Body text is {base}; headings step through the scale — never arbitrary sizes.
4. Elevation strategy is "{strategy}" — {if border: do not add box-shadows}.
5. Every interactive element has hover, active, focus-visible, and disabled states.
6. Focus rings are always visible and always {focus recipe}.
7. Transitions are {duration}ms {easing}. Nothing animates longer than {slow}ms.
8. Respect prefers-reduced-motion: fall back to {fallback}.

## Tokens
{colour table with role, value, contrast ratio}
{type scale table with size, line-height, tracking, weight, usage}
{spacing scale}
{radii, shadows, borders}

## Component recipes
{per role: exact classes/values for base + each state}

## Anti-patterns for this system
{"Do not use rounded-full on buttons — this system uses 10px radius throughout."
 "Do not add drop shadows to cards — separation is via border only."
 "Do not use more than one accent colour on a single screen."}
```

The **anti-patterns section** is what stops agent drift. It is the difference between "applied the tokens" and "actually looks like the reference". Generate it from the DRP by inverting the strong signals (if `elevation.strategy = 'border'`, emit the no-shadows rule; if all radii are equal, emit the consistency rule; if the palette has one accent, emit the restraint rule).

### 8.2 Why this ordering matters

You can build §8 with only §6 and §7 complete — no codemods, no AST work, no restyling engine at all. It is roughly two weeks of work and probably delivers most of what you actually want. Build it, use it on three real projects, *then* decide whether §9 and §10 are worth building.

---

## 9. Deterministic restyle (`stylesync apply --deterministic`)

Safe, fast, free, reversible. No LLM. This is where the bulk of the visual change comes from.

### 9.1 Preconditions

- Working tree clean, or `--force`. The tool refuses to run on a dirty tree — git is the entire safety net, so it must be usable.
- Prints a summary and asks for confirmation before writing.
- Records the operation in `packs` so `stylesync history` can tell you what you did to which project.

### 9.2 Transforms

| Transform | Implementation |
|---|---|
| Token injection | postcss writes `:root` block from `tokens.css`; adds the import to the global stylesheet |
| Tailwind theme | Rewrites `theme.extend` (v3) or the `@theme` block (v4) from the DRP |
| Raw colour → token | postcss + scan of hex/rgb/hsl values; maps by nearest OKLCH distance to the palette; `--preserve-brand '#FF6B00'` excludes pinned colours |
| Tailwind class rewrite | Parse class lists, map utility-by-utility via a generated table (`bg-blue-600` → `bg-primary`); unknown classes pass through untouched |
| Spacing snap | Snap px values to the nearest scale step within ±2px tolerance |
| Font swap | Replace `@font-face` / Google Font links / `font-family` declarations; wire up `next/font` where Next.js is detected |
| Radius + shadow | Direct declaration replacement per component class |
| Motion | Add `transition-*` utilities or CSS transitions per `motion.signatures`, wrapped in a `prefers-reduced-motion` guard |
| Focus rings | Add `focus-visible` styling to every element classified as an action or input role |

### 9.3 Write boundary (kept from v1 — still worth it)

Git gives you rollback, but a codemod that mangles a handler wastes your afternoon regardless. A `MutationGuard` wraps every AST write; each write declares its target node path and mutation kind and the guard **throws** on violation.

**Allowed:** CSS/SCSS/module files · `class`/`className`/`:class` string literals and static template parts · `style` object literals · Tailwind config theme keys · token files · `styled-components`/`emotion` template literals · adding `aria-*`.

**Forbidden:** function bodies · hooks · handler bodies · imports · exports · props passed to logic · `key`, `ref`, `data-testid`, `id`, `name` · routes · data fetching · test files · build/deploy config · `package.json` deps.

After application, assert: imports unchanged, exports unchanged, every handler identifier still present, every user-visible string still present. Any failure → abort and revert (`git checkout .`).

### 9.4 Verification

Much lighter than v1 — no containers, no visual-regression service:

1. Modified files re-parse.
2. `tsc --noEmit` if TypeScript.
3. The project's own build command.
4. `stylesync shots` — a Playwright script that screenshots each detected route before and after at 3 viewports, writing to `.stylesync/shots/`. You look at them. That's the regression test.
5. `axe-core` pass on each route; report violations before vs after.

On build failure: print the error, revert cleanly, tell you which transform was last applied.

---

## 10. Agent-assisted last mile (Claude Code skill)

The 30% that codemods can't do — component recipe alignment, layout adoption, structural polish — is handled by the agent you already use, inside your project, rather than by a server-side pipeline.

`packages/skill/` ships a Claude Code skill:

```
.claude/skills/restyle/
├── SKILL.md
└── reference/
    ├── boundaries.md      # the §9.3 write boundary, as agent rules
    └── checklist.md       # per-component QA checklist
```

**SKILL.md triggers on:** requests to restyle, re-skin, or apply a design system, when `.stylesync/STYLEPACK.md` exists in the project.

**Its procedure:**
1. Read `.stylesync/STYLEPACK.md` and `components.md`.
2. Inventory components and classify each into a role (§ Appendix B vocabulary).
3. Work **one component at a time**, never project-wide.
4. For each: apply the recipe for its role, add all four interaction states, apply the focus ring, respect the anti-patterns list.
5. After each component, verify against `boundaries.md`, then move on.
6. At the end, run the project build and `stylesync shots`.

**Why a skill rather than an API pipeline:** it runs in your actual project with your actual dev server, it costs nothing to build beyond the markdown, and it composes with everything else you already do in Claude Code. This replaces the entire v1 restyle-planner / restyle-applier / sandbox-preview service tier.

> **Composition note:** `impeccable` slots in naturally right here as a post-restyle gate — run it after step 6, feed its findings back as a second pass. That gives you extraction (StyleSync) → application (skill) → critique (impeccable) as a closed loop, which is a genuinely strong setup.

---

## 11. Web UI (localhost)

Three screens. No auth, no onboarding, no marketing.

### 11.1 Library (`/`)

- Sticky filter rail + virtualised masonry grid.
- **Filters:** source, category, theme mode (light/dark), density, colour (swatch picker doing OKLCH-proximity search), descriptor tags, confidence floor, favourites, "has live CSS".
- **Search:** FTS5 over title/tags/descriptors. Natural-language search via local embeddings is Phase 3, not day one.
- **Card:** thumbnail, source badge, title, 5-swatch palette strip, confidence dot, and — critically — a **`ref_lapa_4821` id with a click-to-copy button**, because that id is what you type into the CLI.
- Sort: newest, recently synced, most used, favourites.

### 11.2 Reference detail (`/ref/[id]`)

Left: screenshot gallery, flow sequence player for flow sources, motion clip with scrubber for motion sources.

Right, tabbed:
- **Tokens** — colour ramps with contrast annotations, type scale as live specimens, spacing as a visual ruler, radii and shadows as swatches.
- **Components** — **live rendered previews of each recipe** (button, input, card, table, badge, modal) built from the extracted tokens. This is the moment the tool proves itself: the reference's design system, reconstituted as working components you can hover and focus.
- **Provenance** — source, origin URL, creator credit, capture date, method, confidence, "Re-sync this reference".

Primary action: a copyable command — `stylesync pack ref_lapa_4821`.

### 11.3 Sources (`/sources`)

Per-source row: status dot, items indexed, last sync, average confidence, adapter health. Actions: sync now, full re-sync, view log, pause. Sync-run detail shows added / updated / unchanged / failed with the changed-reference list.

### 11.4 UI conventions

Dark by default, neutral chrome (the references supply the colour), monospace for all token values and ids, keyboard navigation throughout, skeletons not spinners, and every async surface defines empty / loading / error / partial states. The app's own theme is generated by its own extractor — dogfooding is a requirement.

---

## 12. CLI reference

```
stylesync sync [--source <id>] [--full]        Delta-sync sources
stylesync doctor                                Adapter health, partial captures, failed DRPs
stylesync search <query> [--source] [--tag]     Search from the terminal
stylesync show <ref_id>                         Print the DRP summary
stylesync pack <ref_id> [--out .stylesync]      Generate the Style Pack into cwd
stylesync apply --deterministic [--dry-run]     Run codemods
stylesync apply --only colors,fonts,radius      Subset of transforms
stylesync shots [--routes /,/dashboard]         Before/after screenshots
stylesync history [--project .]                 What was applied where, when
stylesync web                                   Start the local library on :4321
```

Global flags: `--preserve-brand <hex...>`, `--intensity conservative|balanced|bold`, `--force`, `--json`.

**Intensity semantics:**
- `conservative` — token values only. No class restructuring. Typically <15% of styled lines touched.
- `balanced` *(default)* — tokens + component recipe alignment (padding, states, focus, elevation) + motion.
- `bold` — the above + layout adoption (nav pattern, container width, grid, density) to match the reference's composition.

---

## 13. Build order

| Phase | Duration | Deliverable | Done when |
|---|---|---|---|
| **0 — Foundations** | 2 days | Monorepo, SQLite schema, CLI skeleton, Playwright harness, config-driven adapter loader | `stylesync doctor` runs and reports zero sources |
| **1 — Ingestion (4 sources)** | 1 week | Lapa Ninja, Figma, SaaS Pages, Godly adapters; capture pipeline; delta sync | 500+ refs indexed, nightly delta sync runs clean |
| **2 — DRP extraction** | 1 week | Tier A + B extraction, OKLCH clustering, quality gate, `stylesync show` | ≥80% of refs at confidence ≥0.75 |
| **3 — Style Pack** | 4 days | Pack generator, STYLEPACK.md, tokens.css, tailwind theme, components.md, anti-patterns | Packed into 3 real projects and hand-applied via Claude Code with a visible improvement |
| **⏸ CHECKPOINT** | — | **Stop and use it for two weeks.** | Decide whether phases 4–6 are worth it |
| **4 — Library UI** | 1 week | Next.js library, filters, reference detail with live component previews | You reach for it instead of Mobbin |
| **5 — Deterministic apply** | 1 week | Codemods, write boundary, verification, `stylesync shots` | Build passes on all 3 test projects after apply |
| **6 — Skill + remaining sources** | 1 week | Claude Code skill; Refero, Banani, UX Archive, Design Spells; tier C vision extraction | 8/8 adapters healthy; skill restyles a component set end to end |

The checkpoint after Phase 3 is deliberate. A little over two weeks in, you have the thing that probably delivers most of the value, and real evidence about whether the rest is worth building.

---

## 14. Test projects (right-sized)

Keep three real projects in `test-fixtures/`, each with a build command and one smoke check:

1. **Next.js + Tailwind** — the common case for AI-generated apps.
2. **Vite + React + plain CSS** — no utility framework, tests the CSS-file path.
3. **A deliberately messy one** — inline styles, no component structure, duplicated CSS. This is what vibe-coded output actually looks like, and it's the real test.

Pass criteria after `stylesync apply --deterministic`: builds, typechecks, no new console errors on any route, visible change in the shots, no a11y regression.

---

## 15. Risks (the ones that still apply)

| Risk | Mitigation |
|---|---|
| Adapters break when sites change | Selectors in YAML not code; degrade to screenshot-only; `stylesync doctor` surfaces it |
| Extraction produces an ugly or inaccessible palette | Quality gate + contrast auto-correction + confidence shown everywhere |
| Codemod mangles something | Clean-tree precondition, write boundary, post-hoc assertions, `git checkout .` |
| Style Pack too vague for the agent to follow | The anti-patterns section, exact values not adjectives, one component at a time |
| Scope creep back toward v1 | The absent-technology list in §4 is a contract. Reject Redis, Docker, Postgres, queues, auth |

---

## Appendix A — DRP JSON schema

```jsonc
{
  "drp_version": 1,
  "ref_id": "ref_lapa_4821",
  "provenance": {
    "source": "lapa-ninja",
    "origin_url": "https://…",
    "creator_credit": "…",
    "captured_at": "2026-07-30T09:12:00Z",
    "extraction_method": "computed_css",
    "confidence": 0.86
  },

  "identity": {
    "name": "Analytics Dashboard — Deep Indigo",
    "descriptors": ["dark", "high-contrast", "geometric", "data-dense", "b2b-saas"],
    "theme_mode": "dark",
    "density": "compact",
    "character": "Flat surfaces separated by hairline borders rather than shadows. Colour reserved for action and state."
  },

  "color": {
    "palette": {
      "primary": { "base": "#6366F1", "ramp": { "50": "#EEF2FF", "500": "#6366F1", "900": "#312E81" } },
      "neutral": { "base": "#0F172A", "ramp": { "…": "…" } },
      "accent":  { "base": "#22D3EE", "ramp": { "…": "…" } },
      "success": { "base": "#10B981" },
      "warning": { "base": "#F59E0B" },
      "danger":  { "base": "#EF4444" }
    },
    "semantic": {
      "bg.canvas": "neutral.950", "bg.surface": "neutral.900", "bg.raised": "neutral.800",
      "fg.default": "neutral.50", "fg.muted": "neutral.400", "fg.onPrimary": "#FFFFFF",
      "border.default": "neutral.800", "border.focus": "primary.400"
    },
    "contrast_report": { "min_body_ratio": 7.1, "wcag_aa_pass": true, "contrast_adjusted": false }
  },

  "typography": {
    "families": {
      "display": { "stack": "Inter, sans-serif", "source": "google", "weights": [600, 700] },
      "body":    { "stack": "Inter, sans-serif", "source": "google", "weights": [400, 500] },
      "mono":    { "stack": "JetBrains Mono, monospace", "source": "google", "weights": [400] }
    },
    "scale": {
      "ratio": 1.25, "base_px": 16,
      "steps": {
        "xs":   { "size": "0.75rem",  "line": 1.5,  "tracking": "0.01em",  "weight": 400 },
        "sm":   { "size": "0.875rem", "line": 1.5,  "tracking": "0",       "weight": 400 },
        "base": { "size": "1rem",     "line": 1.6,  "tracking": "0",       "weight": 400 },
        "lg":   { "size": "1.25rem",  "line": 1.4,  "tracking": "-0.01em", "weight": 500 },
        "xl":   { "size": "1.75rem",  "line": 1.25, "tracking": "-0.02em", "weight": 600 },
        "2xl":  { "size": "2.5rem",   "line": 1.1,  "tracking": "-0.03em", "weight": 700 }
      }
    }
  },

  "space":  { "unit_px": 4, "scale": [0,1,2,3,4,6,8,12,16,20,24,32,40,48,64], "section_rhythm_px": 96 },
  "shape":  { "radius": { "none":"0","sm":"6px","md":"10px","lg":"16px","pill":"9999px" },
              "border_widths": { "hairline":"1px","emphasis":"2px" } },
  "elevation": {
    "strategy": "border",
    "levels": { "0":"none","1":"0 1px 2px rgb(0 0 0 / .24)","2":"0 4px 12px rgb(0 0 0 / .28)","3":"0 12px 32px rgb(0 0 0 / .36)" }
  },

  "motion": {
    "durations": { "fast": 120, "base": 200, "slow": 360 },
    "easings": { "standard":"cubic-bezier(.2,0,0,1)","entrance":"cubic-bezier(0,0,0,1)","exit":"cubic-bezier(.3,0,1,1)" },
    "signatures": [
      { "trigger":"hover","target":"button","effect":"bg shift","duration":120 },
      { "trigger":"mount","target":"card","effect":"fade + translateY(8px)","duration":200,"stagger":40 }
    ],
    "reduced_motion_fallback": "opacity-only"
  },

  "layout": {
    "container_max_px": 1200,
    "grid": { "columns": 12, "gutter_px": 24 },
    "breakpoints": { "sm":640,"md":768,"lg":1024,"xl":1280 },
    "nav_pattern": "sidebar",
    "content_alignment": "left"
  },

  "components": {
    "button.primary": {
      "bg":"primary.500","fg":"fg.onPrimary","radius":"md","padding":"10px 16px",
      "font":"sm/500","elevation":"1",
      "states": { "hover":{"bg":"primary.400"},"active":{"bg":"primary.600"},
                  "disabled":{"opacity":0.5},"focus":{"ring":"2px border.focus"} }
    },
    "button.secondary": {}, "input.text": {}, "card": {}, "table": {},
    "badge": {}, "nav.sidebar": {}, "modal": {}, "tabs": {}, "empty_state": {}
  },

  "anti_patterns": [
    "Do not add box-shadows to cards — this system separates surfaces with hairline borders.",
    "Do not use rounded-full on buttons — radius is 10px throughout.",
    "Do not introduce a second accent colour on one screen."
  ],

  "assets_policy": { "may_emit_fonts": true, "may_emit_images": false, "may_emit_icons": false }
}
```

## Appendix B — Component role vocabulary (closed set)

```
layout.page, layout.section, layout.sidebar, layout.topbar, layout.grid, layout.stack
nav.primary, nav.secondary, nav.breadcrumb, nav.tabs, nav.pagination
action.button.primary, action.button.secondary, action.button.ghost,
action.button.destructive, action.link, action.icon-button
input.text, input.select, input.checkbox, input.radio, input.toggle,
input.textarea, input.search, input.date, input.file
display.card, display.list, display.table, display.stat, display.badge,
display.avatar, display.chart, display.media, display.code
feedback.alert, feedback.toast, feedback.empty, feedback.loading,
feedback.error, feedback.progress, feedback.skeleton
overlay.modal, overlay.drawer, overlay.popover, overlay.tooltip, overlay.menu
typography.h1..h6, typography.body, typography.caption, typography.label, typography.mono
```

Every role maps to a key in `drp.components` or a documented fallback. The `role → recipe → utility classes` table is a versioned data file, not inline logic.

## Appendix C — Prompt framing for build agents

**Context primer (give once, keep loaded):** §1, §2, §4, §5, §7, §9.3, Appendix A, Appendix B.

**Per-task framing:**

```
You are implementing ONE part of StyleSync Personal, specified in the attached document.

TASK: {section reference and title}
INPUTS: {existing files, interfaces you must conform to}
OUTPUT: {exact file paths to create}

CONSTRAINTS
- This is a single-user local tool. Do NOT add auth, multi-tenancy, Docker,
  Redis, Postgres, message queues, or cloud storage. SQLite and the local
  filesystem only. (§4 absent-technology list.)
- Conform exactly to the interfaces in §{n}. Do not redesign them.
- Do not stub. If something cannot be implemented, say so rather than
  writing a placeholder that looks complete.
- Write a test alongside each module.

Before writing code, restate the interface you are implementing and list
the files you will create.
```
