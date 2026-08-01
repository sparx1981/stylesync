# StyleSync AI — Product & Technical Specification

**Version:** 1.0
**Status:** Build-ready draft
**Audience:** AI coding agents (Claude, Gemini / Google AI Studio) and the human engineers reviewing their output.

---

## 0. How to use this document with an AI coding agent

This spec is written to be consumed in slices, not in one prompt. Feeding all of it into a single generation request produces a shallow scaffold. Instead:

1. Give the agent **§1–§4** (context, scope, architecture) as a persistent system/context file.
2. Then issue **one build task per section** from §5 onward, in the order of the roadmap (§18).
3. Every task must end with the acceptance criteria in §17 restated as the definition of done.
4. Treat §7 (Design Reference Profile) and §11 (Restyling Engine) as the two contracts that must not drift. If a change is needed, change the spec first, then the code.

**Non-negotiable constraints for any agent working on this codebase:**

- The restyling engine may never alter application logic. See §11.4 for the enforced write-boundary.
- All ingestion adapters implement the same interface (§6.2). No bespoke pipelines per source.
- All source data flows through the Design Reference Profile normalisation layer (§7). The restyler never reads a raw scrape.
- Every restyle produces a reviewable **plan** before it produces code (§11.3).

---

## 1. Product overview

### 1.1 The problem

Teams find a UI they admire, then spend days manually translating it into their own codebase — reading colours off screenshots, guessing spacing scales, rebuilding component structure. The gap between "I like that" and "my app looks like that" is entirely manual labour.

### 1.2 The product

StyleSync AI is a web application with two halves:

- **Inspiration Library** — a permanently cached, searchable index of free UI design references pulled from eight public sources, normalised into machine-usable design data (tokens, layout rules, component patterns, motion specs) rather than just images.
- **Restyling Engine** — the user uploads their application as a ZIP, picks a reference from the library, and receives a restyled version of their own codebase with all behaviour intact, delivered as a downloadable ZIP or a GitHub pull request.

### 1.3 Value proposition

> Turn any design you admire into a design system, and apply it to your codebase in minutes — without touching a line of business logic.

### 1.4 Primary personas

| Persona | Context | Primary job-to-be-done | Success signal |
|---|---|---|---|
| **Solo builder / indie hacker** | Ships functional but visually generic apps, often AI-generated | "Make my working prototype look like a real product" | Downloads restyled ZIP, ships it |
| **Frontend engineer at a startup** | Has a design direction but no designer | "Apply this aesthetic consistently across 40 components" | Opens the GitHub PR, merges ~80% of it |
| **Product designer** | Explores directions before committing | "Show me this reference applied to our actual screens" | Shares preview links with the team |
| **Agency / freelancer** | Rebrands or refreshes client apps | "Re-skin this app three ways for a client pitch" | Runs multiple restyles from one upload |

### 1.5 Explicit non-goals (v1)

- Not a design tool — no canvas, no drawing, no Figma-style editing.
- Not a code generator from scratch — it restyles existing code, it does not invent features.
- Not a hosting platform — previews are ephemeral, not production deployments.
- Not a Mobbin replacement for browsing alone — browsing exists to serve the restyle.
- No backend/API restyling, no database changes, no mobile-native (Swift/Kotlin) source in v1.

---

## 2. Scope

### 2.1 In scope (v1)

**Ingestion**
- Eight source adapters (§6.3), each producing normalised references.
- Permanent backend storage of full representations plus metadata.
- On-demand delta re-sync with content hashing; scheduled background sync.

**Library**
- Search, filter, and faceted browse across all indexed references.
- Reference detail view exposing extracted tokens, layout, typography, components, motion.

**Restyling**
- ZIP upload up to 250 MB, dynamic stack detection.
- Mode A: In-place restyle (framework preserved).
- Mode B: Framework transformation (target stack: React + TypeScript + Tailwind, optionally with Radix primitives).
- Behaviour-preservation guarantees enforced by static analysis and tests.

**Review & export**
- Side-by-side live preview (original vs restyled) in a sandbox.
- File-level and hunk-level code diff with accept/reject.
- Export to ZIP; export to GitHub pull request.

### 2.2 Out of scope (v1, candidate for v2+)

- Figma plugin / bidirectional Figma sync.
- Team workspaces, roles, shared libraries.
- Custom reference upload ("restyle to match *this* screenshot I took").
- Continuous restyling (watch a repo, keep it in style).
- Angular and Svelte as *transformation targets* (they are supported as *inputs* for in-place restyle only).

---

## 3. Legal, ethical and compliance requirements

**This section is a hard requirement, not a disclaimer.** The product's core asset is third-party content, and the design of the ingestion layer must reflect that or the product is not shippable.

### 3.1 Principles

1. **Prefer official access.** Where a source offers an API, RSS, sitemap, or export (notably Figma's REST API), use it. Only fall back to headless rendering where no official channel exists.
2. **Respect robots.txt and rate limits.** Each adapter declares a crawl budget; the scheduler enforces it globally, not per-worker.
3. **Cache privately, display minimally.** Full DOM/CSS snapshots are stored as a *private derivation cache* used to compute tokens. What the end user sees in the library is: a thumbnail, the derived design data, attribution, and a link to the original.
4. **Attribute always.** Every reference card and every generated PR description carries source name, original URL, and (where available) original designer/creator credit.
5. **Derive, don't redistribute.** The restyling engine consumes *derived design parameters* (colour ramps, type scale, spacing rhythm, radii, shadow recipes, motion curves) — not copied markup or assets. Third-party logos, photography, and brand assets are never emitted into a user's restyled output.
6. **Honour takedowns.** A per-reference `takedown_state` field; an admin action removes a reference from the library and from future restyles within one sync cycle.
7. **Per-source policy config.** Each adapter carries a `compliance` block declaring what may be stored, what may be displayed, and retention period. The pipeline enforces it; a missing block fails the adapter's health check.

### 3.2 Required implementation artefacts

- `config/sources/*.yaml` with a mandatory `compliance:` block per source.
- A `ComplianceGate` service that every ingestion write passes through.
- An admin "Source compliance" dashboard showing, per source: access method, robots.txt status, last review date, retention policy, takedown count.
- User-facing "Sources & attribution" page.

### 3.3 User-uploaded code

- Uploaded archives are private to the uploading account, encrypted at rest, and deleted after a configurable retention window (default 30 days; user can delete immediately).
- Uploaded code is never used as training data. State this in the UI at upload time.
- Secret scanning runs on upload; detected credentials are redacted from any logs and previews, and the user is warned (§16.3).

---

## 4. System architecture

### 4.1 High-level

```
┌────────────────────────────────────────────────────────────────────┐
│  Web App (Next.js App Router, React, TypeScript, Tailwind)         │
│  Library Explorer · Upload · Restyle Config · Diff Workbench       │
└───────────────┬────────────────────────────────────────────────────┘
                │ REST + SSE (job progress)
┌───────────────▼────────────────────────────────────────────────────┐
│  API Gateway (Next.js Route Handlers / Node + Fastify)             │
│  Auth · Rate limiting · Job orchestration · Signed asset URLs      │
└──┬────────────────┬───────────────────┬───────────────────┬────────┘
   │                │                   │                   │
┌──▼──────────┐ ┌───▼───────────┐ ┌─────▼─────────┐ ┌───────▼───────┐
│ Ingestion   │ │ Normalisation │ │ Restyle       │ │ Preview       │
│ Workers     │ │ (DRP builder) │ │ Workers       │ │ Sandbox       │
│ Playwright  │ │ token/layout  │ │ AST + codemod │ │ isolated      │
│ + adapters  │ │ extraction    │ │ + LLM planner │ │ containers    │
└──┬──────────┘ └───┬───────────┘ └─────┬─────────┘ └───────┬───────┘
   │                │                   │                   │
┌──▼────────────────▼───────────────────▼───────────────────▼───────┐
│  Data layer                                                        │
│  Postgres (metadata, jobs, DRP index)  ·  Object store (S3/GCS)    │
│  Redis (queue, cache)  ·  Vector store (semantic reference search) │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Recommended stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui, Radix | Matches the transformation target, so the app dogfoods its own output |
| API | Next.js Route Handlers for CRUD; Fastify service for long jobs | Keeps the deploy simple, isolates heavy work |
| Job queue | BullMQ on Redis | Retries, priorities, concurrency caps per source |
| Crawling | Playwright (Chromium), stealth-light config, per-source concurrency | Same tooling family the user already works with |
| Parsing | `ts-morph` / Babel (JS/TS), `@vue/compiler-sfc`, `svelte/compiler`, `angular-html-parser`, `postcss`, `parse5` | Per-language AST access |
| Codemods | `jscodeshift`, custom `postcss` plugins | Deterministic, testable transforms |
| LLM | Claude (planning, mapping, ambiguous transforms) + Gemini (bulk vision/classification) behind a provider-agnostic interface | Model choice is a config value, never hardcoded |
| Storage | Postgres 16 + S3-compatible object store | Relational metadata, blob payloads |
| Search | Postgres FTS + pgvector for semantic similarity | Avoids a second search service in v1 |
| Sandbox | Firecracker / gVisor containers, no egress, ephemeral URLs | Untrusted user code must not have network or host access |
| Observability | OpenTelemetry, Sentry, structured JSON logs | Job-level tracing is essential for debugging restyles |

> **Note on alternatives:** if the team prefers Firestore for persistence, the metadata model in §5 maps to document collections cleanly, but the reference search facets and the job DAG are materially easier in Postgres. Recommend Postgres for v1.

### 4.3 Core services

| Service | Responsibility |
|---|---|
| `ingest-worker` | Runs a source adapter, fetches raw payloads, writes to object store, emits `raw_capture` records |
| `drp-builder` | Converts raw captures into Design Reference Profiles (§7) |
| `sync-manager` | Schedules crawls, computes deltas, enforces crawl budgets and compliance gates |
| `stack-detector` | Analyses an uploaded archive, produces a Project Manifest (§9) |
| `restyle-planner` | Produces a reviewable Restyle Plan from Project Manifest + DRP (§11.3) |
| `restyle-applier` | Executes the plan via codemods, verifies build, produces diff |
| `preview-runtime` | Builds and serves original and restyled apps in isolated sandboxes |
| `export-service` | Produces ZIP artefacts and GitHub PRs |

---

## 5. Data model

### 5.1 Entity relationships

```
User ─┬─< Project ─┬─< Upload (archive) ──< ProjectManifest
      │            └─< RestyleJob ──< RestylePlan ──< FileChange
      └─< SyncRequest

Source ──< Reference ──< DesignReferenceProfile
                    └──< ReferenceAsset (screenshot, dom, css, video, figma node)
```

### 5.2 Postgres schema (abridged DDL)

```sql
create table sources (
  id                text primary key,              -- 'banani', 'lapa-ninja', ...
  display_name      text not null,
  category          text not null,                 -- flows | web | vector | motion
  access_method     text not null,                 -- api | sitemap | headless
  base_url          text not null,
  crawl_budget_rpm  int  not null default 6,
  compliance        jsonb not null,                -- see §3.2
  enabled           boolean not null default true,
  last_full_sync_at timestamptz,
  last_delta_sync_at timestamptz
);

create table references_ (
  id                uuid primary key default gen_random_uuid(),
  source_id         text references sources(id),
  external_id       text not null,                 -- id on the source site
  origin_url        text not null,
  title             text,
  creator_credit    text,
  captured_at       timestamptz not null,
  last_synced_at    timestamptz not null,
  content_hash      text not null,                 -- sha256 of normalised capture
  visual_hash       text,                          -- perceptual hash of screenshot
  takedown_state    text not null default 'active',-- active | withdrawn
  status            text not null default 'ready', -- pending | ready | failed
  unique (source_id, external_id)
);

create table reference_assets (
  id            uuid primary key default gen_random_uuid(),
  reference_id  uuid references references_(id) on delete cascade,
  kind          text not null,   -- screenshot | thumbnail | dom | css | video | lottie | figma_node | flow_graph
  storage_key   text not null,   -- object store path
  mime_type     text,
  bytes         bigint,
  meta          jsonb
);

create table design_reference_profiles (
  reference_id  uuid primary key references references_(id) on delete cascade,
  version       int not null default 1,
  profile       jsonb not null,  -- the DRP document, §7.2
  embedding     vector(1536),    -- semantic search over style description
  confidence    numeric(3,2),    -- 0..1 extraction confidence
  built_at      timestamptz not null
);

create table projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table uploads (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete cascade,
  storage_key   text not null,
  filename      text not null,
  bytes         bigint not null,
  sha256        text not null,
  manifest      jsonb,             -- Project Manifest, §9.3
  scan_result   jsonb,             -- secrets/malware scan
  expires_at    timestamptz not null,
  status        text not null      -- uploaded | scanning | analysed | rejected
);

create table restyle_jobs (
  id            uuid primary key default gen_random_uuid(),
  upload_id     uuid references uploads(id) on delete cascade,
  reference_id  uuid references references_(id),
  mode          text not null,     -- in_place | transform
  options       jsonb not null,    -- §10.2
  status        text not null,     -- queued | planning | awaiting_review | applying | verifying | ready | failed
  plan          jsonb,             -- Restyle Plan, §11.3
  metrics       jsonb,             -- §17.3
  error         jsonb,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create table file_changes (
  id             uuid primary key default gen_random_uuid(),
  restyle_job_id uuid references restyle_jobs(id) on delete cascade,
  path           text not null,
  change_type    text not null,    -- modified | added | deleted | renamed
  rationale      text,             -- why the engine changed this
  diff           text,             -- unified diff
  accepted       boolean default true,
  risk           text              -- low | medium | high
);

create table sync_runs (
  id            uuid primary key default gen_random_uuid(),
  source_id     text references sources(id),
  trigger       text not null,     -- scheduled | manual | backfill
  started_at    timestamptz not null,
  finished_at   timestamptz,
  discovered    int default 0,
  added         int default 0,
  updated       int default 0,
  unchanged     int default 0,
  failed        int default 0,
  log_key       text
);
```

### 5.3 Object storage layout

```
/sources/{source_id}/{reference_id}/
    screenshot@2x.webp
    thumbnail.webp
    dom.snapshot.json
    computed-styles.json
    stylesheet.bundle.css
    flow-graph.json          # flow sources only
    motion.webm              # motion sources only
    figma-node.json          # figma only
/uploads/{upload_id}/archive.zip
/restyles/{job_id}/output.zip
/restyles/{job_id}/screenshots/{route}-{variant}.webp
```

---

## 6. Ingestion & synchronisation engine

### 6.1 Pipeline

```
discover ──▶ fetch ──▶ capture ──▶ hash ──▶ delta check ──▶ store raw ──▶ build DRP ──▶ index
   │           │          │                     │
   │           │          │                     └─ unchanged → update last_synced_at only
   │           │          └─ screenshot, DOM, computed CSS, assets, motion
   │           └─ respects robots.txt, crawl budget, backoff
   └─ sitemap / API / paginated listing
```

### 6.2 Adapter interface (every source implements this)

```ts
export interface SourceAdapter {
  readonly id: string;
  readonly category: 'flows' | 'web' | 'vector' | 'motion';
  readonly compliance: CompliancePolicy;

  /** Enumerate available items without fetching them in full. */
  discover(ctx: CrawlContext): AsyncIterable<DiscoveredItem>;

  /** Cheap signature used to decide whether a full fetch is needed. */
  signature(item: DiscoveredItem, ctx: CrawlContext): Promise<string>;

  /** Full capture: returns raw payloads to persist. */
  capture(item: DiscoveredItem, ctx: CrawlContext): Promise<RawCapture>;

  /** Health probe: selectors still valid? API reachable? */
  health(ctx: CrawlContext): Promise<HealthReport>;
}

export interface RawCapture {
  externalId: string;
  originUrl: string;
  title?: string;
  creatorCredit?: string;
  assets: RawAsset[];              // screenshot, dom, css, video, figma node...
  hints: CaptureHints;             // category tags, platform, theme, source-declared metadata
}
```

Adapters are the **only** place source-specific logic lives. Everything downstream sees `RawCapture`.

### 6.3 Per-source adapter specifications

| # | Source | Category | Access method | Capture payload | Notes for the agent |
|---|---|---|---|---|---|
| 1 | **Banani** | flows | Headless render of public gallery | Screen sequence images, flow ordering, category tags, platform | Flow ordering is the key signal — persist as `flow-graph.json` with node order and screen roles |
| 2 | **UX Archive** | flows | Headless render | Journey name (onboarding, checkout, search…), ordered screens, app name | Primary value is the *journey taxonomy*; map to `drp.patterns.flows[]` |
| 3 | **Refero.design** | web + iOS patterns | Headless render, faceted listing | Screen images, component/pattern labels, platform | Rich component taxonomy — use it to seed the component-role vocabulary in §8.2 |
| 4 | **Lapa Ninja** | web / landing | Sitemap + headless render, then render the *linked live site* for CSS | Full-page screenshot, live-site DOM + computed CSS, category, colour tags | Highest-value CSS source: landing pages are public live sites, so token extraction is real, not inferred |
| 5 | **Godly** | web / high-end | Headless render + live-site render | Full-page screenshot, computed CSS, motion capture (scroll-driven), tech tags (Framer/Webflow) | Capture a 6-second scroll video to derive motion curves |
| 6 | **SaaS Pages / Interface Index** | web / B2B app UI | Headless render | Screenshots by page type (pricing, settings, dashboard, empty states) | Best source for *application* patterns — dashboards, tables, forms |
| 7 | **Figma Community** | vector | **Official Figma REST API + OAuth** | Node tree, vector primitives, component variants, auto-layout props, variables/styles | Never scrape. Use `GET /v1/files/:key` and `/v1/files/:key/variables`. This is the only source that yields *authoritative* tokens |
| 8 | **Design Spells** | motion | Headless render | Clip (webm), trigger type, element type, timing description | Derive `drp.motion` easing/duration; map trigger → interaction class |

### 6.4 Capture routine (headless sources)

For each item:

1. Launch page with a fixed viewport matrix: `390×844` (mobile), `1440×900` (desktop), DPR 2.
2. Block third-party trackers; allow fonts and images.
3. Wait for network idle + fonts ready + 500 ms settle.
4. Capture: full-page screenshot (WebP, quality 82), serialised DOM snapshot, `getComputedStyle` for every visible element (sampled — see below), all stylesheet text, font faces, and the CSS custom-property table from `:root`.
5. **Computed-style sampling**: capturing every element is wasteful. Sample (a) all elements with a distinct `tagName+class` signature, capped at 2,000, and (b) all elements matching heuristics for buttons, inputs, cards, headings, nav, and tables.
6. For motion sources: record a 6 s webm at 30 fps while scripted interaction runs (scroll, hover on interactive elements).
7. Emit `RawCapture`.

### 6.5 Delta & re-sync

- **Content hash**: `sha256` over a canonicalised capture (DOM with volatile attributes stripped, computed styles sorted, text normalised). Stored on `references_.content_hash`.
- **Visual hash**: perceptual hash (pHash) of the screenshot, to catch visual change where DOM is dynamic.
- **Delta decision**: refetch full capture only if `signature()` differs, or if `last_synced_at` older than the source's `max_age`. If both hashes match after capture, discard the new blobs and only bump `last_synced_at`.
- **Triggers**: nightly scheduled sync per source (staggered); manual "Sync now" per source; manual "Re-sync this reference" per card; full backfill (admin only).
- **Sync report**: every run writes a `sync_runs` row and a human-readable log; the UI surfaces added / updated / unchanged / failed counts and a diff list.
- **Resilience**: adapters degrade rather than fail — if the DOM selector breaks, still store the screenshot, mark `status='partial'`, and raise a health alert.

---

## 7. The Design Reference Profile (DRP) — the core contract

The DRP is the single normalised artefact that decouples the eight messy sources from the restyling engine. **The restyler never reads a raw capture.**

### 7.1 What it must express

Enough to restyle an arbitrary app: a colour system with semantic roles, a type scale, a spacing rhythm, radii, elevation, borders, motion, component recipes, and layout characteristics — plus provenance and confidence.

### 7.2 DRP JSON schema (v1)

```jsonc
{
  "drp_version": 1,
  "reference_id": "8f2c…",
  "provenance": {
    "source": "lapa-ninja",
    "origin_url": "https://…",
    "creator_credit": "…",
    "captured_at": "2026-07-30T09:12:00Z",
    "extraction_method": "computed_css",     // computed_css | figma_api | vision_inferred
    "confidence": 0.86
  },

  "identity": {
    "name": "Analytics Dashboard — Deep Indigo",
    "descriptors": ["dark", "high-contrast", "geometric", "data-dense", "b2b-saas"],
    "theme_mode": "dark",                     // light | dark | dual
    "density": "compact"                      // compact | comfortable | spacious
  },

  "color": {
    "palette": {
      "primary":   { "base": "#6366F1", "ramp": { "50": "#EEF2FF", "…": "…", "900": "#312E81" } },
      "neutral":   { "base": "#0F172A", "ramp": { "…": "…" } },
      "accent":    { "base": "#22D3EE", "ramp": { "…": "…" } },
      "success":   { "base": "#10B981" },
      "warning":   { "base": "#F59E0B" },
      "danger":    { "base": "#EF4444" }
    },
    "semantic": {
      "bg.canvas": "neutral.950",
      "bg.surface": "neutral.900",
      "bg.raised": "neutral.800",
      "fg.default": "neutral.50",
      "fg.muted": "neutral.400",
      "fg.onPrimary": "#FFFFFF",
      "border.default": "neutral.800",
      "border.focus": "primary.400"
    },
    "contrast_report": { "min_body_ratio": 7.1, "wcag_aa_pass": true, "wcag_aaa_pass": true }
  },

  "typography": {
    "families": {
      "display": { "stack": "Inter, sans-serif", "source": "google", "weights": [600, 700] },
      "body":    { "stack": "Inter, sans-serif", "source": "google", "weights": [400, 500] },
      "mono":    { "stack": "JetBrains Mono, monospace", "source": "google", "weights": [400] }
    },
    "scale": {
      "ratio": 1.25,
      "base_px": 16,
      "steps": {
        "xs":   { "size": "0.75rem",  "line": 1.5,  "tracking": "0.01em", "weight": 400 },
        "sm":   { "size": "0.875rem", "line": 1.5,  "tracking": "0",      "weight": 400 },
        "base": { "size": "1rem",     "line": 1.6,  "tracking": "0",      "weight": 400 },
        "lg":   { "size": "1.25rem",  "line": 1.4,  "tracking": "-0.01em","weight": 500 },
        "xl":   { "size": "1.75rem",  "line": 1.25, "tracking": "-0.02em","weight": 600 },
        "2xl":  { "size": "2.5rem",   "line": 1.1,  "tracking": "-0.03em","weight": 700 }
      }
    }
  },

  "space": { "unit_px": 4, "scale": [0,1,2,3,4,6,8,12,16,20,24,32,40,48,64], "section_rhythm_px": 96 },

  "shape": {
    "radius": { "none": "0", "sm": "6px", "md": "10px", "lg": "16px", "pill": "9999px" },
    "border_widths": { "hairline": "1px", "emphasis": "2px" }
  },

  "elevation": {
    "levels": {
      "0": "none",
      "1": "0 1px 2px rgb(0 0 0 / 0.24)",
      "2": "0 4px 12px rgb(0 0 0 / 0.28)",
      "3": "0 12px 32px rgb(0 0 0 / 0.36)"
    },
    "strategy": "shadow"                       // shadow | border | glow | flat
  },

  "motion": {
    "durations": { "fast": 120, "base": 200, "slow": 360 },
    "easings": { "standard": "cubic-bezier(0.2,0,0,1)", "entrance": "cubic-bezier(0,0,0,1)", "exit": "cubic-bezier(0.3,0,1,1)" },
    "signatures": [
      { "trigger": "hover", "target": "button", "effect": "translateY(-1px) + shadow.2", "duration": 120 },
      { "trigger": "mount", "target": "card", "effect": "fade + translateY(8px)", "duration": 200, "stagger": 40 }
    ],
    "reduced_motion_fallback": "opacity-only"
  },

  "layout": {
    "container_max_px": 1200,
    "grid": { "columns": 12, "gutter_px": 24 },
    "breakpoints": { "sm": 640, "md": 768, "lg": 1024, "xl": 1280 },
    "nav_pattern": "sidebar",                  // topbar | sidebar | tabbar | none
    "content_alignment": "left"
  },

  "components": {
    "button.primary": {
      "bg": "primary.500", "fg": "fg.onPrimary", "radius": "md",
      "padding": "10px 16px", "font": "sm/500", "elevation": "1",
      "states": { "hover": { "bg": "primary.400" }, "active": { "bg": "primary.600" }, "disabled": { "opacity": 0.5 }, "focus": { "ring": "2px border.focus" } }
    },
    "button.secondary": { "…": "…" },
    "input.text":       { "…": "…" },
    "card":             { "…": "…" },
    "table":            { "…": "…" },
    "badge":            { "…": "…" },
    "nav.sidebar":      { "…": "…" },
    "modal":            { "…": "…" },
    "tabs":             { "…": "…" },
    "empty_state":      { "…": "…" }
  },

  "patterns": {
    "flows": [
      { "name": "onboarding", "steps": ["welcome", "signup", "personalise", "success"], "assets": ["…"] }
    ],
    "page_archetypes": ["dashboard", "pricing", "settings", "auth"]
  },

  "assets_policy": { "may_emit_fonts": true, "may_emit_images": false, "may_emit_icons": false }
}
```

### 7.3 Extraction strategy by confidence tier

| Tier | Method | Applies to | Confidence |
|---|---|---|---|
| **A — Authoritative** | Figma Variables/Styles API | Figma Community | 0.95–1.0 |
| **B — Measured** | Computed CSS from the live site, statistically clustered | Lapa Ninja, Godly, SaaS Pages | 0.75–0.95 |
| **C — Inferred** | Vision model over screenshots + palette quantisation + OCR type measurement | Banani, UX Archive, Refero, Design Spells | 0.45–0.75 |

**Tier B clustering algorithm (specify precisely — agents get this wrong):**

1. Collect every computed `color`, `background-color`, `border-color` weighted by rendered pixel area.
2. Convert to OKLCH; cluster with k-means (k tuned 4–8 by silhouette score).
3. Assign roles: largest-area low-chroma cluster → neutral/canvas; highest-chroma cluster appearing on interactive elements → primary; clusters on elements matching success/warn/error heuristics → semantic.
4. Generate a full 50–950 ramp per cluster by interpolating lightness in OKLCH while holding hue and scaling chroma to a perceptual curve.
5. Type scale: collect `font-size` frequencies, snap to the nearest common modular ratio (1.125/1.2/1.25/1.333/1.5), keep measured line-heights.
6. Spacing: collect margins/paddings/gaps, find the greatest common divisor within tolerance ±1px → `unit_px`.
7. Radii/shadows: mode of measured values per component class.
8. Record `confidence` as the mean cluster silhouette × coverage of sampled elements.

**Tier C:** vision model prompt returns the same DRP shape with `extraction_method: "vision_inferred"`. Always lower confidence; the UI must show it (§13.5).

### 7.4 DRP quality gate

A DRP is only published to the library if: it has ≥3 palette roles, a type scale of ≥4 steps, a spacing unit, and passes a WCAG AA contrast check for `fg.default` on `bg.canvas`. Failing DRPs go to an admin repair queue. **If the extracted palette fails contrast, the engine auto-corrects lightness and flags `contrast_adjusted: true` rather than propagating an inaccessible design.**

---

## 8. Semantic component mapping (the bridge)

Restyling only works if the engine knows *what a thing is* in the user's app before it decides how it should look.

### 8.1 Role classification

For each component/element in the uploaded project, assign one or more roles from a fixed vocabulary. Classification uses, in priority order:
1. Explicit signals — component filename, exported name, `role`/`aria-*` attributes, semantic HTML tag.
2. Structural heuristics — an element with `onClick` + short text child → `button`; `<input>`+`<label>` → `field`; repeated sibling containers with an image + heading → `card grid`.
3. LLM classification for the remainder, given the component source and its usage sites.

### 8.2 Role vocabulary (v1, closed set)

```
layout.page, layout.section, layout.sidebar, layout.topbar, layout.grid, layout.stack
nav.primary, nav.secondary, nav.breadcrumb, nav.tabs, nav.pagination
action.button.primary, action.button.secondary, action.button.ghost, action.button.destructive,
action.link, action.icon-button
input.text, input.select, input.checkbox, input.radio, input.toggle, input.textarea,
input.search, input.date, input.file
display.card, display.list, display.table, display.stat, display.badge, display.avatar,
display.chart, display.media, display.code
feedback.alert, feedback.toast, feedback.empty, feedback.loading, feedback.error,
feedback.progress, feedback.skeleton
overlay.modal, overlay.drawer, overlay.popover, overlay.tooltip, overlay.menu
typography.h1..h6, typography.body, typography.caption, typography.label, typography.mono
```

Every role has a corresponding key in `drp.components` (or a documented fallback). The mapping table `role → DRP recipe → target styling primitive` is the heart of the engine and must be a versioned, unit-tested data file, not inline logic.

---

## 9. Upload & stack detection

### 9.1 Upload requirements

- Accepts `.zip` (v1), max 250 MB, max 20,000 files, max 10:1 compression ratio (zip-bomb guard).
- Rejects archives containing symlinks, absolute paths, or `..` traversal.
- Ignores by default: `node_modules`, `.git`, `dist`, `build`, `.next`, `vendor`, `*.lock` (retained but never modified).
- Streams to object storage; never fully extracted to local disk outside the sandbox.
- Presents a live progress state: upload → scan → extract → analyse.

### 9.2 Detection signals

| Signal | Infers |
|---|---|
| `package.json` deps (`next`, `react`, `vue`, `svelte`, `@angular/core`, `astro`, `nuxt`) | Framework + version |
| `tailwind.config.*`, `@import "tailwindcss"` in CSS | Tailwind + version (v3 vs v4 differ materially) |
| `*.module.css`, `styled-components`, `emotion`, `sass`, `less`, `panda`, `vanilla-extract` | Styling system |
| `tsconfig.json` | TypeScript |
| File extensions across `src/` | Component languages |
| Presence of `app/` vs `pages/` | Next.js router flavour |
| `index.html` + no build config | Static HTML/CSS/JS |
| Existing design-token files (`theme.ts`, `tokens.json`, CSS custom properties in `:root`) | Existing token surface — **highest-value restyle target** |

If no framework matches, fall back to **generic mode**: treat as HTML/CSS/JS, restyle stylesheets and inline styles only.

### 9.3 Project Manifest (output of detection)

```jsonc
{
  "manifest_version": 1,
  "stack": {
    "framework": "next", "framework_version": "14.2.3",
    "language": "ts", "router": "app",
    "styling": ["tailwind@3", "css-modules"],
    "component_libs": ["radix-ui"],
    "package_manager": "pnpm"
  },
  "surfaces": {
    "token_files": ["tailwind.config.ts", "src/styles/theme.css"],
    "global_styles": ["src/app/globals.css"],
    "component_files": [
      { "path": "src/components/Button.tsx", "exports": ["Button"], "roles": ["action.button.primary"], "styling": "tailwind", "loc": 84 }
    ],
    "route_files": ["src/app/page.tsx", "src/app/dashboard/page.tsx"],
    "asset_files": ["public/logo.svg"],
    "logic_files": ["src/lib/api.ts", "src/hooks/useCart.ts"]
  },
  "stats": { "components": 24, "routes": 6, "logic_files": 12, "total_files": 318 },
  "capabilities": { "can_build": true, "build_command": "pnpm build", "dev_command": "pnpm dev", "has_tests": false },
  "warnings": ["No lockfile found — dependency install may drift"]
}
```

The manifest is shown to the user before they configure the restyle (§13.3). It is also the input the planner reasons over — so it must be complete and accurate, not decorative.

---

## 10. Restyle configuration

### 10.1 Modes

**Mode A — In-place restyle (default).** Framework, file structure, routing, and component boundaries are preserved. Only the style surface changes: token files, stylesheets, class attributes, style props, and — where a component visually demands it — the *presentational* JSX/template structure inside a component (e.g. wrapping content in a card shell). Logic is untouched.

**Mode B — Framework transformation.** The UI layer is rehoused in the target stack (React + TypeScript + Tailwind, optional Radix primitives, optional shadcn/ui component set) while behaviour is mapped 1:1. Required guarantees:
- Every route in the source has a corresponding route in the output.
- Every user-triggerable action in the source exists in the output and calls the same underlying function or endpoint.
- Data fetching, state shape, and API contracts are preserved verbatim where the language allows; where the source framework's idiom has no direct equivalent (e.g. Vue `watch` → React `useEffect`), the mapping is documented in the plan with a `medium` or `high` risk flag.

Mode B is offered only when the planner's feasibility check passes (§11.2). If it fails, the UI explains why and offers Mode A.

### 10.2 Options object

```jsonc
{
  "mode": "in_place",
  "intensity": "balanced",            // conservative | balanced | bold
  "scope": { "include": ["src/**"], "exclude": ["src/legacy/**"] },
  "apply": {
    "color": true, "typography": true, "spacing": true, "radius": true,
    "elevation": true, "motion": true, "layout_structure": false
  },
  "preserve": {
    "brand_colors": ["#FF6B00"],      // user-pinned colours the engine must not replace
    "logos_and_assets": true,
    "copy_text": true,
    "class_names_used_by_tests": true,
    "data_test_ids": true
  },
  "accessibility": { "enforce_wcag": "AA", "respect_reduced_motion": true },
  "dark_mode": "follow_reference",    // follow_reference | add_both | keep_existing
  "target": {                          // mode=transform only
    "framework": "react-next", "styling": "tailwind", "primitives": "radix", "component_set": "shadcn"
  }
}
```

**Intensity semantics** — define these explicitly, they drive user trust:
- `conservative`: tokens only (colour, type, radius, spacing values). No structural change, no class restructuring. Typically <15% of lines touched.
- `balanced`: tokens + component recipe alignment (padding, elevation, states, focus rings) + motion. Presentational wrappers may be added.
- `bold`: the above + layout adoption (nav pattern, container widths, grid, section rhythm, density) to match the reference's composition.

---

## 11. Restyling engine

### 11.1 Pipeline

```
Manifest + DRP + Options
        │
        ▼
 [1] Style Surface Extraction  ── inventory every styling decision in the project
        ▼
 [2] Feasibility Check         ── can we do the requested mode? report blockers
        ▼
 [3] Mapping Resolution        ── source style value → DRP token, per role
        ▼
 [4] Plan Synthesis            ── ordered, file-scoped, reviewable change plan
        ▼   (user reviews / edits — optional gate)
 [5] Deterministic Application ── codemods execute the plan
        ▼
 [6] LLM-Assisted Application  ── only for changes the plan marks 'requires_generation'
        ▼
 [7] Verification              ── typecheck, lint, build, tests, visual regression, a11y
        ▼
 [8] Repair Loop (max 3)       ── failures fed back with error context
        ▼
 Diff + Preview + Export
```

### 11.2 Feasibility check

Returns blockers before any work is done. Examples: no parseable component files; framework not supported for the requested target; build fails on the *original* code (then preview is unavailable but restyle can still proceed with a warning); project exceeds size ceilings; >40% of files unparseable.

### 11.3 The Restyle Plan (reviewable artefact)

```jsonc
{
  "plan_version": 1,
  "summary": {
    "files_affected": 41, "components_restyled": 24,
    "tokens_introduced": 68, "risk": { "low": 36, "medium": 4, "high": 1 },
    "estimated_visual_change": 0.72
  },
  "token_layer": {
    "strategy": "css_variables_plus_tailwind_theme",
    "writes": [
      { "path": "src/styles/tokens.css", "action": "create", "preview": ":root{--color-bg-canvas:…}" },
      { "path": "tailwind.config.ts", "action": "modify", "preview": "theme.extend.colors = …" }
    ]
  },
  "changes": [
    {
      "id": "c-001",
      "path": "src/components/Button.tsx",
      "role": "action.button.primary",
      "operations": [
        { "type": "replace_class_list", "from": "btn-legacy-blue padding-10",
          "to": "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary shadow-1 transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50" },
        { "type": "add_state_variants", "states": ["hover","focus-visible","active","disabled"] }
      ],
      "requires_generation": false,
      "risk": "low",
      "rationale": "Reference button.primary recipe: indigo-500 fill, 10px radius, elevation 1, 120ms colour transition.",
      "logic_untouched_assertion": true
    },
    {
      "id": "c-014",
      "path": "src/app/dashboard/page.tsx",
      "role": "layout.page",
      "operations": [{ "type": "adopt_layout", "pattern": "sidebar", "container_max_px": 1200 }],
      "requires_generation": true,
      "risk": "medium",
      "rationale": "Reference uses persistent sidebar navigation; source uses topbar. Only applied at intensity=bold."
    }
  ],
  "assets": { "fonts_to_add": ["Inter:400,500,600,700"], "fonts_removed": ["Roboto"] },
  "not_changed": [
    { "path": "src/lib/api.ts", "reason": "logic file — outside write boundary" }
  ]
}
```

The plan is rendered in the UI as an editable list (§13.4). The user may reject individual changes before application. **This is the single most important trust feature in the product.**

### 11.4 Write boundary (enforced, not advisory)

The applier operates through a permission layer. Allowed mutations:

| Allowed | Forbidden |
|---|---|
| CSS/SCSS/Less files, CSS modules | Any expression that is not a string literal in a style position |
| `class` / `className` / `:class` string literals and template literals with static parts | Function bodies, hooks, effects, event-handler bodies |
| `style` attribute/prop object literals | Imports of non-UI modules |
| Tailwind config theme keys | Route definitions, API calls, data fetching |
| Design-token files | `package.json` dependencies (except approved UI deps in Mode B) |
| Presentational JSX/template wrapper elements | Props that are passed to logic, `key`, `ref`, `data-testid` |
| `styled-components` / `emotion` template literals | Test files, config for build/deploy, env files |
| Adding `aria-*` attributes that improve a11y | Removing existing `aria-*`, `id`, `name`, `data-*` |

Implementation: a `MutationGuard` wraps every AST write. Each write declares its target node path and mutation kind; the guard validates against the boundary table and **throws** on violation. Every violation is logged as a defect, not silently skipped.

**Behaviour-preservation assertion**, run after application:
- The set of imported modules per file is unchanged (Mode A).
- The set of exported symbols per file is unchanged (Mode A).
- Every event handler identifier present before is present after.
- Every string that appears as user-visible copy before appears after (unless `preserve.copy_text` is false).
- AST diff restricted to allowed node types — any change outside them fails the job.

### 11.5 Deterministic codemods (do this before reaching for the LLM)

| Transform | Implementation |
|---|---|
| CSS custom property injection | postcss plugin writes `:root` token block |
| Raw colour → token | postcss + regex over hex/rgb/hsl, mapped via nearest-OKLCH-match to DRP palette, with `preserve.brand_colors` excluded |
| Spacing normalisation | postcss: snap px values to nearest DRP spacing step within tolerance |
| Tailwind class rewriting | Parse class lists, map utility-by-utility via a generated mapping table (`bg-blue-600` → `bg-primary`), preserve unknown classes |
| Tailwind theme generation | Write `theme.extend` (v3) or `@theme` block (v4) from DRP |
| Font swap | Replace `@font-face`/Google Font links + `font-family` declarations; add `next/font` where applicable |
| Radius / shadow | Direct declaration replacement |
| Motion | Add `transition-*` utilities or CSS transitions per DRP `motion.signatures`, gated by `prefers-reduced-motion` |
| Focus ring insertion | Add focus-visible styling to every `action.*` and `input.*` role |

Target: **≥70% of changes deterministic** at `conservative`/`balanced` intensity. Deterministic changes are reproducible, cheap, and reviewable — the LLM is for the rest.

### 11.6 LLM-assisted changes

Used only where `requires_generation: true` — layout adoption, component recipe restructuring, Mode B transformation, and ambiguous mappings.

Rules for the agent implementing this:
- **One component per call.** Never send the whole project.
- **Structured input:** component source + its role + the relevant DRP slice + the specific operations + the write boundary + the exact output contract.
- **Structured output:** return the full new file *and* a machine-checkable statement of what changed. Reject and retry if the behaviour-preservation assertion fails.
- **Deterministic settings:** temperature 0–0.2, seeded where supported.
- **Model-agnostic interface:** `LlmProvider.transform(request): Promise<TransformResult>`; Claude and Gemini both implement it. Model IDs live in config.
- **Cost control:** cache by `(file_hash, drp_version, operations_hash)`. Identical inputs never re-generate.

**Prompt contract template (Mode A component restyle):**

```
SYSTEM
You are a code transformation engine. You restyle UI components. You never change behaviour.

HARD RULES
- Do not add, remove, or rename imports, exports, props, hooks, handlers, or state.
- Do not change any string that is user-visible copy.
- Do not remove data-testid, id, name, key, ref, or aria-* attributes.
- Only change: class/className values, style props, presentational wrapper elements, and CSS.
- Use only the tokens provided. Never invent a colour, size, or font.
- Output only a JSON object matching the OUTPUT SCHEMA. No prose, no markdown fences.

INPUT
component_path: {path}
component_role: {role}
design_tokens: {drp_slice}
requested_operations: {operations}
source:
{file_contents}

OUTPUT SCHEMA
{ "new_source": "...", "changed_elements": [{"selector":"...","from":"...","to":"..."}],
  "behaviour_preserved": true, "notes": "..." }
```

### 11.7 Verification

Run in the sandbox after application:

1. **Parse** — every modified file re-parses.
2. **Typecheck** — `tsc --noEmit` if TypeScript.
3. **Lint** — project's own ESLint/Stylelint config if present.
4. **Build** — the manifest's build command. Failure triggers the repair loop with the error text.
5. **Tests** — run existing tests if present. Any newly failing test fails the job.
6. **Visual regression** — screenshot every discovered route, original vs restyled, at 3 viewports. Compute a structural-similarity delta. Flag routes where *layout* changed but `apply.layout_structure` was false (a bug), and routes where nothing changed (a miss).
7. **Accessibility** — axe-core on every route. The restyled output must have **no more** violations than the original, and must pass the configured WCAG level for contrast.
8. **Token coverage** — % of colour/spacing/type declarations now referencing tokens. Report it.

Failures in 1–5 enter the repair loop (max 3 attempts, each fed the specific error). Failures in 6–8 are reported as warnings on the diff view, not hard failures.

---

## 12. Preview, diff and export

### 12.1 Sandbox preview

- Two containers per job: `original` and `restyled`. Install deps (offline mirror or allow-listed registry), run the dev/build command, serve on an internal port.
- No network egress from the sandbox. No host mounts. CPU/memory capped. Hard TTL 30 min idle.
- Frontend renders both in synchronised iframes: shared route, shared scroll position, shared viewport selector (mobile / tablet / desktop), theme toggle.
- If the original cannot build, show static screenshots + a clear explanation rather than an error state.

### 12.2 Diff workbench

- File tree with change counts, risk badges, and role labels.
- Unified or split diff per file, syntax highlighted.
- Each hunk carries the plan's `rationale` ("why did it do this?") — non-negotiable for trust.
- Accept/reject per hunk and per file; rejecting recomputes the output bundle without re-running the LLM.
- Filter: by risk, by role, by change type, by "generated vs deterministic".

### 12.3 Export

- **ZIP**: the full project with accepted changes only, plus `STYLESYNC.md` documenting the reference used, tokens introduced, files changed, and known risks.
- **GitHub PR**: OAuth app; creates branch `stylesync/{reference-slug}-{short-id}`, commits changes grouped logically (tokens → components → layout → motion), opens a PR with a body containing the summary table, the reference attribution and link, screenshots (before/after per route), and the risk list. Never force-pushes, never touches the default branch.
- **Token export**: `tokens.json` (W3C Design Tokens Community Group format), `tokens.css`, and `tailwind.theme.ts` — usable standalone even if the user rejects all code changes.

---

## 13. UX specification

### 13.1 Information architecture

```
/                      Landing (logged out) / Dashboard (logged in)
/library               Inspiration Explorer
/library/:id           Reference detail (visuals + extracted design system)
/projects              My Apps
/projects/:id          Project overview: uploads, restyle history
/projects/:id/new      Restyle wizard (upload → reference → config → run)
/jobs/:id              Job progress
/jobs/:id/review       Plan review
/jobs/:id/diff         Split preview + code diff
/sources               Source status, sync controls, attribution
/settings              Account, GitHub connection, retention, API keys
/admin/*               Adapter health, compliance, repair queue
```

### 13.2 Primary flow (the golden path — must be ≤4 deliberate steps)

```
Browse library ──▶ "Restyle my app with this" ──▶ Upload ZIP ──▶ Configure ──▶ Review plan ──▶ Preview & diff ──▶ Export
     (or)  Upload first ──▶ "Find a style" ──▶ (same from here)
```

Both entry points must work. Users arrive either inspiration-first or code-first.

### 13.3 Screen specifications

**S1 — Inspiration Explorer (`/library`)**

- Layout: sticky filter rail (left, collapsible on mobile), masonry grid of reference cards, infinite scroll with virtualisation.
- Filters: source, category (mobile flow / landing / SaaS app / motion / vector), theme mode, density, colour (swatch picker with OKLCH proximity search), descriptor tags, extraction confidence, has-live-CSS.
- Search: hybrid — full-text over title/tags plus semantic search over the DRP `identity.descriptors` embedding. Natural-language queries must work: "dark data-dense dashboard with soft cards".
- Card: thumbnail, source badge, title, 5-swatch palette strip, confidence dot, quick actions (Preview, Use this style, Save).
- Sort: relevance, newest, recently synced, most used.
- Empty state: explains sources and offers "Run first sync".
- Loading: skeleton cards, never a spinner over the whole grid.

**S2 — Reference Detail (`/library/:id`)**

Two-column. Left: visual gallery (screenshots, flow sequence player for flow sources, motion clip player with a scrubber for motion sources). Right: the *extracted design system*, tabbed:

- **Tokens** — colour ramps with contrast annotations, type scale rendered as live specimens, spacing scale as a visual ruler, radii and shadows as swatches.
- **Components** — rendered live previews of each `drp.components` recipe (button, input, card, table…) using the extracted tokens. **This is the product's "wow" moment: the user sees the reference's design system reconstituted as working components.**
- **Motion** — signature list with play-on-hover demos.
- **Provenance** — source, original URL, creator credit, capture date, extraction method, confidence, "Re-sync this reference".

Primary CTA, persistent: **Restyle my app with this style**.

**S3 — Upload (`/projects/:id/new`, step 1)**

- Large dropzone; also accepts paste of a GitHub URL as a v1.1 stretch.
- Live progress: Uploading → Scanning → Extracting → Analysing.
- On completion, render the Project Manifest as a readable summary card: detected stack, components found, routes found, styling system, warnings. Include an expandable file tree with role labels so the user can sanity-check detection and correct it (a role dropdown per component).
- Privacy notice inline: retention window, "not used for training", delete-now button.

**S4 — Configure (`/projects/:id/new`, step 3)**

- Reference summary (thumbnail + palette) with a "change" link.
- Mode selector: two large cards (In-place / Transform) with plain-language consequences and a feasibility badge. Disabled Transform shows *why*.
- Intensity: 3-position segmented control with a live illustrative preview of a sample card at each setting.
- Apply toggles (colour, typography, spacing, radius, elevation, motion, layout).
- Preserve section: pinned brand colours (colour picker + "detect my brand colours" which surfaces the most-used non-neutral colours in the source), keep logos/assets, keep test ids.
- Accessibility: enforce WCAG AA (default on), respect reduced motion (default on).
- Estimated cost/time indicator.
- CTA: **Generate plan** (not "Start restyling" — the plan is the next artefact, and naming it honestly sets expectations).

**S5 — Job progress (`/jobs/:id`)**

- Vertical stepper with live SSE updates: Extract surface → Check feasibility → Resolve mapping → Synthesise plan → Apply → Verify.
- Per-step detail line (e.g. "Mapped 24 components, 3 need generation").
- Cancellable at every step. Backgroundable — the user may leave; notify on completion (in-app + optional email).

**S6 — Plan review (`/jobs/:id/review`)**

- Summary bar: files affected, components restyled, tokens introduced, risk distribution, estimated visual change.
- Grouped change list: Tokens → Components (by role) → Layout → Motion → Assets.
- Each row: path, role, risk badge, one-line rationale, expandable operation detail, include/exclude toggle.
- "Not changed" section, explicitly listing logic files and why — this reassures more than anything else in the product.
- CTA: **Apply plan**.

**S7 — Diff workbench (`/jobs/:id/diff`)**

- Top: split preview iframes, synchronised, with route selector, viewport selector, theme toggle, and an opacity slider for overlay comparison.
- Bottom: resizable diff panel — file tree left, diff right, rationale in a side note per hunk.
- Header actions: Download ZIP, Open PR, Re-run with different intensity, Try another reference (reuses the same upload — one upload, many restyles).
- Verification results as a collapsible strip: build ✓, typecheck ✓, tests ✓, a11y (2 improved / 0 regressed), visual delta per route, token coverage 84%.

**S8 — Sources (`/sources`)**

- Table per source: status dot, items indexed, last sync, next scheduled sync, extraction confidence average, adapter health.
- Actions: Sync now (delta), Full re-sync (admin), View log, Pause source.
- Sync run detail: added / updated / unchanged / failed with a diff list of changed references.

### 13.4 States (specify all four for every async surface)

Every list, card, preview, and job surface must define: **empty**, **loading** (skeleton, not spinner), **error** (cause + recovery action, never a raw stack trace), **partial** (e.g. reference captured but DRP low-confidence; restyle succeeded but build failed).

### 13.5 Trust and honesty in the UI

- Confidence is always visible on a reference (dot + tooltip explaining the extraction method).
- The plan is always reviewable before code changes.
- "Not changed" is always shown, not hidden.
- Generated (LLM) changes are visually distinguished from deterministic ones in the diff.
- Attribution is on the card, the detail page, the PR body, and the exported `STYLESYNC.md`.
- Never claim the output is production-ready. The language is "review these changes", not "your app is restyled".

### 13.6 Accessibility requirements for StyleSync itself

WCAG 2.2 AA. Full keyboard operation of the explorer grid, diff navigation, and plan review. Visible focus everywhere. `prefers-reduced-motion` respected. All colour information paired with text or icon. Diff not conveyed by colour alone (use +/− markers). Screen-reader labels on all icon buttons. Live regions for job progress.

### 13.7 Responsive

Desktop-first (this is a workbench tool) but: library browse, reference detail, and job status must be fully usable on mobile. The diff workbench degrades to a stacked, read-only view below `md` with a clear "open on desktop to edit" affordance.

### 13.8 Visual design direction for the app itself

Restrained, tool-like, content-forward — the references are the colour, so the chrome is neutral. Dark mode first with a light theme available. A single accent for primary actions. Generous negative space in the explorer, dense and functional in the workbench. Monospace for all code and token values. The app's own tokens must be generated by its own DRP pipeline from its own design — dogfooding is a requirement, not a nicety.

---

## 14. API specification (v1)

All routes under `/api/v1`. JSON. Bearer auth. Cursor pagination (`?cursor=&limit=`).

```
# Library
GET    /references                    ?q&source&category&theme&density&color&tags&min_confidence&sort
GET    /references/:id
GET    /references/:id/drp
POST   /references/:id/resync         → { sync_run_id }
GET    /references/:id/assets/:kind   → 302 signed URL

# Sources
GET    /sources
GET    /sources/:id
POST   /sources/:id/sync              { mode: 'delta' | 'full' } → { sync_run_id }
GET    /sync-runs/:id                 → progress + counts + log URL

# Projects & uploads
POST   /projects                      { name }
GET    /projects/:id
POST   /projects/:id/uploads          multipart or presigned-PUT flow → { upload_id }
GET    /uploads/:id                   → status + manifest
PATCH  /uploads/:id/manifest          { component_roles: { path: role } }   # user corrections
DELETE /uploads/:id

# Restyling
POST   /restyle-jobs                  { upload_id, reference_id, mode, options } → { job_id }
GET    /restyle-jobs/:id
GET    /restyle-jobs/:id/events       → SSE progress stream
GET    /restyle-jobs/:id/plan
PATCH  /restyle-jobs/:id/plan         { excluded_change_ids: [...] }
POST   /restyle-jobs/:id/apply
GET    /restyle-jobs/:id/diff         ?path
PATCH  /restyle-jobs/:id/changes/:cid { accepted: boolean }
POST   /restyle-jobs/:id/cancel

# Preview
POST   /restyle-jobs/:id/preview      → { original_url, restyled_url, expires_at }
DELETE /restyle-jobs/:id/preview

# Export
POST   /restyle-jobs/:id/export/zip   → { download_url, expires_at }
POST   /restyle-jobs/:id/export/github { repo, base_branch } → { pr_url }
GET    /restyle-jobs/:id/export/tokens ?format=json|css|tailwind
```

**Error envelope** (uniform, agent-friendly):

```jsonc
{ "error": { "code": "UNSUPPORTED_STACK", "message": "…", "detail": { … }, "retryable": false, "docs_url": "…" } }
```

---

## 15. Job orchestration & progress model

- Every long operation is a job with states: `queued → running(step) → succeeded | failed | cancelled`.
- Steps emit typed progress events over SSE: `{ step, status, percent, message, artifacts }`.
- Idempotency: `POST` job creation accepts an `Idempotency-Key`.
- Retries: transient failures retry with exponential backoff (max 3). LLM failures retry with a repair prompt (max 3). Determinism failures never retry blindly — they fail loudly.
- Concurrency: per-user cap (default 2 concurrent restyles), per-source crawl cap, global worker pool.
- Every job stores full structured logs, retained 30 days, downloadable by the user.

---

## 16. Non-functional requirements

### 16.1 Performance targets

| Operation | Target (p50) | Target (p95) |
|---|---|---|
| Library search response | 200 ms | 600 ms |
| Reference detail load | 400 ms | 1.2 s |
| Upload analysis (300-file project) | 20 s | 60 s |
| Plan synthesis (24 components) | 45 s | 120 s |
| Plan application + verification | 90 s | 300 s |
| Preview ready (both containers) | 60 s | 180 s |
| Delta sync, one source | 3 min | 10 min |

### 16.2 Scale assumptions (v1)

50k references; 500k reference assets; 5k monthly active users; 20k restyle jobs/month; average project 300 files / 25 MB.

### 16.3 Security

- **Untrusted code**: uploaded archives are executed only in a sandbox with no egress, no host mount, seccomp-restricted, CPU/mem capped, hard TTL.
- **Archive safety**: zip-bomb ratio limit, path-traversal rejection, symlink rejection, file-count cap, per-file size cap.
- **Dependency install**: allow-listed registry proxy only; no arbitrary postinstall scripts (`--ignore-scripts`), with a clear warning where that breaks a build.
- **Secret scanning**: gitleaks-style rules on upload; detected secrets are redacted from logs, excluded from previews, and reported to the user with a "we found credentials in your archive" warning.
- **Tenancy**: object-store keys namespaced by user; signed URLs expire in 15 min; no cross-tenant reference to upload artefacts.
- **Crawler egress**: ingestion workers on a separate network policy from user-code sandboxes; never share credentials.
- **GitHub OAuth**: minimum scopes, token encrypted at rest, revocable from settings.
- **Rate limits**: per-user and per-IP on all mutating endpoints.

### 16.4 Reliability

- Adapter health checks run hourly; three consecutive failures pause the source and alert.
- Restyle jobs are resumable from the last completed step.
- Object-store writes are content-addressed and idempotent.
- Graceful degradation: if the DRP for a reference is low confidence, the restyle still runs but the UI warns and the plan marks affected changes `medium` risk.

### 16.5 Observability

- Traces spanning: request → job → step → LLM call → sandbox operation.
- Metrics: sync success rate per source, DRP confidence distribution, restyle success rate by framework, build-pass rate, repair-loop invocation rate, deterministic-vs-generated change ratio, LLM token spend per job, preview startup time.
- Dashboards for adapter health, job funnel, cost per restyle.

---

## 17. Quality, acceptance criteria and evaluation

### 17.1 Definition of done for the restyling engine

A restyle is **successful** when all of the following hold:

1. The restyled project builds with the same command as the original.
2. All pre-existing tests that passed before still pass.
3. The behaviour-preservation assertions in §11.4 all hold.
4. Every route renders without console errors.
5. Accessibility violations ≤ original, and contrast meets the configured WCAG level.
6. Visual delta per route is above a minimum threshold (something actually changed) and below a maximum for `conservative`/`balanced` (nothing was destroyed).
7. Token coverage ≥60% of colour/spacing/typography declarations.
8. Every change in the diff has a rationale.

### 17.2 Golden test corpus (build this before the engine)

Maintain 12 reference projects committed to the repo, spanning: Next.js+Tailwind, Next.js+CSS Modules, CRA+styled-components, Vite+React+plain CSS, Vue 3 SFC+scoped CSS, Nuxt+Tailwind, SvelteKit, Angular, static HTML/CSS/JS, an AI-generated single-file app, a monorepo, and a deliberately messy project (inline styles, no structure, duplicated CSS). Each has a build command and a smoke test.

Every engine change runs the full matrix: 12 projects × 6 references × 2 modes × 3 intensities, with §17.1 as the pass criteria. Regression in pass rate blocks merge.

### 17.3 Metrics recorded per job

```jsonc
{
  "files_changed": 41, "lines_changed": 1204,
  "deterministic_changes": 37, "generated_changes": 4,
  "build_passed": true, "tests_passed": true, "repair_attempts": 0,
  "a11y_before": 7, "a11y_after": 3,
  "visual_delta_by_route": { "/": 0.71, "/dashboard": 0.64 },
  "token_coverage": 0.84,
  "llm_tokens": { "input": 184320, "output": 31204 },
  "wall_clock_ms": 138400
}
```

### 17.4 Product success metrics

| Metric | Target (6 months post-launch) |
|---|---|
| Upload → export conversion | >40% |
| Restyle build-pass rate | >90% |
| Median accepted-hunk ratio in the diff | >75% |
| Repeat restyles per upload | >1.8 |
| Library search → restyle start rate | >15% |
| Sources with healthy adapters | 8/8 for 95% of days |

---

## 18. Roadmap

### Phase 0 — Foundations (2 weeks)
Repo, CI, auth, Postgres + object store, job queue, sandbox base image, golden test corpus (§17.2), LLM provider abstraction, observability skeleton.

### Phase 1 — Ingestion & Library (4 weeks)
Adapter interface + compliance gate; three adapters first (**Lapa Ninja, SaaS Pages, Figma Community** — the highest-fidelity token sources); DRP builder tiers A and B; delta sync + sync reports; Library Explorer and Reference Detail with live component previews.
**Exit criteria:** 2,000+ references indexed, ≥80% with confidence ≥0.75, delta sync runs nightly without manual intervention.

### Phase 2 — Upload & In-Place Restyle (5 weeks)
Upload pipeline, stack detection, Project Manifest, style-surface extraction, role classification, mapping resolution, plan synthesis, deterministic codemods, verification, diff workbench, ZIP export.
**Exit criteria:** golden corpus pass rate ≥85% for Mode A at conservative and balanced intensity.

### Phase 3 — Preview & Trust (3 weeks)
Sandbox preview (both variants), plan review UI with per-change accept/reject, visual regression, a11y checks, rationale surfacing, token export, GitHub PR export.
**Exit criteria:** preview p95 <180 s; accepted-hunk ratio ≥70% in internal testing.

### Phase 4 — Remaining sources & vision extraction (3 weeks)
Banani, UX Archive, Refero, Godly, Design Spells adapters; DRP tier C (vision-inferred); motion extraction; flow-graph storage and the flow player.
**Exit criteria:** 8/8 adapters healthy; motion signatures applied in restyles.

### Phase 5 — Framework Transformation (5 weeks)
Mode B: feasibility checker, route mapping, logic mapping, component rehousing to React+TS+Tailwind(+Radix/shadcn), transformation-specific verification.
**Exit criteria:** golden corpus pass rate ≥70% for Mode B from Vue, Svelte, and static HTML sources; 100% route parity.

### Phase 6 — Polish & scale (ongoing)
Bold intensity / layout adoption, brand-colour detection, saved style presets, team workspaces, custom reference upload, continuous restyling.

---

## 19. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Source ToS / copyright exposure | High | §3 compliance layer; derive-don't-redistribute; official APIs first; takedown workflow; legal review before public launch |
| Adapter breakage when sites change | High | Health checks, graceful degradation to screenshot-only, alerting, selector configs in YAML not code |
| Restyle breaks the user's app | High | Write boundary, behaviour assertions, build/test verification, plan review, per-hunk rejection, golden corpus regression gate |
| LLM output nondeterminism | Medium | Deterministic codemods for the majority; temperature 0; structured output contracts; caching; repair loop with hard cap |
| Extraction produces ugly or inaccessible palettes | Medium | DRP quality gate, contrast auto-correction, confidence surfacing, curated fallback recipes |
| Cost per restyle exceeds price | Medium | Deterministic-first strategy, per-file caching, token budgets per job, cost metric on every job |
| Preview sandbox abuse (crypto mining, egress) | High | No egress, CPU/mem caps, TTL, `--ignore-scripts`, abuse detection |
| "Restyled but not actually better" | Medium | Component-preview wow moment, intensity control, multiple restyles per upload, visual delta reporting |

---

## 20. Open decisions for the product owner

1. **Pricing model** — per restyle, per seat, or credits? Affects job cost caps and concurrency defaults.
2. **Firestore vs Postgres** — spec assumes Postgres for faceted search and job DAGs; confirm before Phase 0.
3. **Transformation target set** — v1 assumes React+TS+Tailwind only as a *target*. Confirm Vue/Svelte targets are v2.
4. **Design-lint integration** — the `impeccable` design linter could run as a post-restyle quality gate in §11.7, scoring the output and feeding failures back into the repair loop. Recommend adding it in Phase 3.
5. **Reference curation** — fully automated index, or a human-approved "featured" tier? A curated tier materially improves first-run quality.
6. **Self-serve source additions** — should users be able to add their own source URLs (essentially "restyle to match this site")? High value, higher compliance risk.

---

## Appendix A — Glossary

- **DRP (Design Reference Profile)** — the normalised, machine-usable design system extracted from a reference. The engine's only view of a design.
- **Reference** — one indexed item from a source (a screen, a flow, a landing page, a Figma file, a motion clip).
- **Project Manifest** — the analysed description of an uploaded codebase.
- **Restyle Plan** — the reviewable, file-scoped set of proposed changes.
- **Write boundary** — the enforced set of code locations the engine is permitted to mutate.
- **Intensity** — how far the restyle goes: tokens only, component recipes, or full layout adoption.
- **Delta sync** — re-crawl that fetches only changed or new references, decided by content and visual hashing.

## Appendix B — Prompt templates for the build agents

**B.1 — Context primer (give once, keep in context):** §1, §2, §3.1, §4, §7.2, §8.2, §11.4.

**B.2 — Per-task framing:**

```
You are implementing ONE component of StyleSync AI, specified in the attached document.

TASK: {section reference and title}
INPUTS: {files that already exist, interfaces you must conform to}
OUTPUT: {files to create, with exact paths}

CONSTRAINTS
- Conform exactly to the interfaces in §{n}. Do not redesign them.
- Write tests alongside implementation. Tests must be runnable with the repo's existing test command.
- Do not stub. If something cannot be implemented, raise it explicitly rather than writing a placeholder.
- Definition of done: {acceptance criteria from §17}

Before writing code, restate the interface contract you are implementing and list the files you will create.
```

**B.3 — Review prompt (run a second agent over the first agent's output):**

```
Review this implementation against §{n} of the specification. Report, as a list:
1. Contract violations (implementation diverges from the specified interface).
2. Write-boundary violations (§11.4).
3. Missing states (§13.4) for any async UI surface.
4. Missing error handling on any I/O or LLM call.
5. Anything stubbed, faked, or hardcoded that the spec requires to be real.
Do not fix. Report only.
```
