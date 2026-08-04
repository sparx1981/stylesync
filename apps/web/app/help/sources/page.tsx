import Link from 'next/link';

export const metadata = { title: 'Sources & syncing — StyleSync Help' };

function SourceCard({
  name,
  tag,
  tier,
  children,
}: {
  name: string;
  tag: string;
  tier: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-[var(--color-fg)]">{name}</h3>
        <span className="font-mono-token rounded-[var(--radius-sm)] bg-[var(--color-raised)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-subtle)]">
          {tag}
        </span>
        <span className="font-mono-token rounded-[var(--radius-sm)] bg-[var(--color-raised)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-subtle)]">
          {tier}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">{children}</p>
    </div>
  );
}

export default function SourcesHelpPage() {
  return (
    <div className="max-w-[820px]">
      <h1 className="mb-2 text-2xl font-semibold">Sources & syncing</h1>
      <p className="mb-8 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        A <strong className="text-[var(--color-fg)]">source</strong> is a place StyleSync knows how to visit and
        capture references from — a curated gallery of landing pages, a Figma file, a library of app screens, and so
        on. &ldquo;Syncing&rdquo; a source means telling StyleSync to go and check it for anything new or changed.
        Every source appears as a row on the <strong className="text-[var(--color-fg)]">Sources</strong> page, in the
        main navigation bar.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">Reading the Sources page</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">Each row shows:</p>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <strong className="text-[var(--color-fg)]">Status</strong> — <span className="text-[var(--color-fg-subtle)]">never synced</span>,{' '}
          <span className="text-[var(--color-success)]">● healthy</span>, or{' '}
          <span className="text-[var(--color-danger)]">● unhealthy</span> (hover the red dot to see why — usually a
          missing key, see below).
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Indexed</strong> — how many references from this source are
          currently in your library.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Last sync</strong> — when this source was last checked.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Confidence avg</strong> — the average extraction confidence across
          every reference from this source (see{' '}
          <Link href="/help/reference-detail#confidence" className="text-[var(--color-accent)] hover:underline">
            Working with a reference
          </Link>
          ).
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Actions</strong> — the buttons described below.
        </li>
      </ul>

      <h3 className="mb-2 mt-6 text-sm font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">The action buttons</h3>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <strong className="text-[var(--color-fg)]">Sync now</strong> — a delta sync. Only new or changed items are
          captured; anything unchanged since last time is skipped, so this is cheap to run often.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Full re-sync</strong> — re-checks every item from this source
          from scratch, ignoring the &ldquo;unchanged since last time&rdquo; shortcut. Slower, but useful if you
          suspect something was captured incorrectly, or after fixing a source&rsquo;s configuration.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">View log</strong> — opens the GitHub Actions run for this sync
          in a new tab. Syncs triggered from the hosted website run in the cloud, not on your own computer, so this is
          where you watch progress or diagnose a failure.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Pause / Resume</strong> — pausing a source excludes it from
          scheduled (automatic) syncs. It doesn&rsquo;t stop you from clicking <strong className="text-[var(--color-fg)]">Sync now</strong> on
          it manually — that always runs regardless of pause state.
        </li>
      </ul>

      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-raised)] p-4 text-sm text-[var(--color-fg-muted)]">
        <strong className="text-[var(--color-fg)]">&ldquo;Needs setup&rdquo; banner.</strong> If a source needs an API
        key or token you haven&rsquo;t configured yet, you&rsquo;ll see an orange banner underneath it listing exactly
        which environment variable is missing, with a link straight to where to get one, plus a link to where to add
        it as a repository secret so the sync worker can use it.
      </div>

      <h2 className="mb-3 mt-10 text-lg font-medium">Capture any page yourself: Ad-hoc URL</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        The built-in sources are curated galleries, so they won&rsquo;t cover everything. For anything else —
        a specific product you admire, a competitor&rsquo;s site, your own project — use the{' '}
        <strong className="text-[var(--color-fg)]">Ad-hoc URL</strong> row at the bottom of the Sources page. Paste a
        full URL into the box and click <strong className="text-[var(--color-fg)]">Capture</strong> (or press Enter).
        This is the same mechanism as every other source, just aimed at one page you choose instead of a whole
        gallery — it&rsquo;ll appear in your library once the capture finishes, with its own confidence score based on
        how much real CSS StyleSync could read from the live page.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">The built-in sources</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Each source captures references a different way, which affects how confident the results are. Higher tiers
        generally mean more of the design was read directly rather than inferred:
      </p>

      <SourceCard name="Figma Community" tag="requires FIGMA_TOKEN" tier="Tier A — highest confidence">
        Reads real design variables (colours, type, spacing) straight out of a Figma file via Figma&rsquo;s official
        API. Because these are the designer&rsquo;s own named variables rather than a reconstruction, this is the most
        reliable source StyleSync has.
      </SourceCard>

      <SourceCard name="Lapa Ninja" tag="landing pages" tier="Tier B — real computed CSS">
        A curated gallery of landing pages. StyleSync opens each page in a real headless browser and follows through
        to the live site to read its actual rendered styles, rather than just the gallery&rsquo;s own preview.
      </SourceCard>

      <SourceCard name="SaaS Pages" tag="SaaS marketing sites" tier="Tier B — real computed CSS">
        A curated gallery of SaaS product and marketing pages, captured the same way — real rendered CSS from the
        live site.
      </SourceCard>

      <SourceCard name="Recent (formerly Godly)" tag="motion & interaction" tier="Tier B — real computed CSS">
        A gallery of sites known for their motion and interaction design. StyleSync drives a real hover and focus on
        the page to capture how buttons and inputs actually change state, not just their resting appearance.
      </SourceCard>

      <SourceCard name="Design Spells" tag="motion & interaction" tier="Tier B — real computed CSS">
        Another motion-and-interaction-focused gallery, captured the same way as Recent.
      </SourceCard>

      <SourceCard name="Banani" tag="requires ANTHROPIC_API_KEY or GEMINI_API_KEY" tier="Tier C — vision-inferred">
        A library of real app screens (flows), captured as screenshots. Because there&rsquo;s no live webpage to read
        CSS from, StyleSync instead shows the screenshot to a vision-capable AI model (Claude or Gemini — whichever
        key you&rsquo;ve set) and asks it to describe the design system it sees. This is genuinely useful but
        necessarily an estimate, so it carries a fixed, more conservative confidence score.
      </SourceCard>

      <SourceCard name="Ad-hoc URL" tag="paste any link" tier="Tier B, usually">
        Captures whatever page you paste in, the same way as Lapa Ninja/SaaS Pages/Recent — real rendered CSS from
        the live page, plus a screenshot as a fallback if the page can&rsquo;t be read directly.
      </SourceCard>

      <h2 className="mb-3 mt-10 text-lg font-medium">Three ways new references show up in your library</h2>
      <ol className="mb-4 ml-5 list-decimal space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <strong className="text-[var(--color-fg)]">Automatically</strong>, on the hosted site&rsquo;s regular
          schedule — you don&rsquo;t have to do anything.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Manually</strong>, by clicking <strong className="text-[var(--color-fg)]">Sync now</strong> or{' '}
          <strong className="text-[var(--color-fg)]">Full re-sync</strong> on a source when you don&rsquo;t want to wait.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">On demand, for one specific page</strong>, using the Ad-hoc URL
          box for anything outside the built-in galleries.
        </li>
      </ol>
    </div>
  );
}
