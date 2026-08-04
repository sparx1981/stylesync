import Link from 'next/link';

export const metadata = { title: 'Working with a reference — StyleSync Help' };

export default function ReferenceDetailHelpPage() {
  return (
    <div className="max-w-[820px]">
      <h1 className="mb-2 text-2xl font-semibold">Working with a reference</h1>
      <p className="mb-8 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        A <strong className="text-[var(--color-fg)]">reference</strong> is one captured design — a single site, page,
        Figma file, or app screen, along with everything StyleSync extracted from it. This page walks through the
        library grid, the reference detail page, and every panel on it.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">The library grid</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        The home page (<strong className="text-[var(--color-fg)]">Library</strong> in the nav bar) shows every
        reference you&rsquo;ve captured as a card. Down the left side, a filter rail lets you search by keyword (it
        searches titles and descriptive tags), filter to one source, or show only your favourites. Each card shows:
      </p>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>A thumbnail screenshot of the captured page.</li>
        <li>Its title and which source it came from.</li>
        <li>A small confidence dot (see below).</li>
        <li>A strip of its main colour swatches, so you can eyeball the palette before opening it.</li>
        <li>
          A <strong className="text-[var(--color-fg)]">Copy ref ID</strong> button — copies the reference&rsquo;s ID to
          your clipboard, ready to paste into <code className="font-mono-token">stylesync pack &lt;ref_id&gt;</code>{' '}
          from the terminal.
        </li>
      </ul>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Click any card to open its full detail page.
      </p>

      <h2 id="confidence" className="mb-3 mt-10 scroll-mt-24 text-lg font-medium">What &ldquo;confidence&rdquo; means</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Every reference has a confidence score from 0 to 1, shown as a small dot and number wherever you see a
        reference:
      </p>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-success)' }} />{' '}
          <strong className="text-[var(--color-fg)]">0.85 and above</strong> — high confidence. Treat the values as
          reliable.
        </li>
        <li>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-warning)' }} />{' '}
          <strong className="text-[var(--color-fg)]">0.60&ndash;0.84</strong> — reasonable, but worth a sanity check
          before relying on it heavily.
        </li>
        <li>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-danger)' }} />{' '}
          <strong className="text-[var(--color-fg)]">below 0.60</strong> — treat as a rough starting point, not ground
          truth.
        </li>
      </ul>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        The number isn&rsquo;t arbitrary — it comes directly from <em>how</em> the reference was captured:
      </p>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <strong className="text-[var(--color-fg)]">Figma variables</strong> (Figma Community source) score around{' '}
          <span className="font-mono-token">0.97</span> — these are the designer&rsquo;s own named values, as
          reliable as it gets.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Real computed CSS</strong> (Lapa Ninja, SaaS Pages, Recent,
          Design Spells, Ad-hoc URL) scores between roughly <span className="font-mono-token">0.45</span> and{' '}
          <span className="font-mono-token">0.95</span>, based on how much of the page&rsquo;s styling could actually
          be read and how well it passes accessibility contrast checks.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Vision-inferred</strong> (Banani) is fixed around{' '}
          <span className="font-mono-token">0.6</span> — an AI model&rsquo;s best read of a static screenshot, useful
          but inherently an estimate rather than a measurement.
        </li>
      </ul>

      <h2 className="mb-3 mt-10 text-lg font-medium">The reference detail page</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Opening a card takes you to its detail page: a screenshot and a few action buttons on the left, and the full
        design breakdown — split into three tabs — on the right.
      </p>

      <h3 className="mb-2 mt-6 text-sm font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">Action buttons</h3>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <code className="font-mono-token rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[13px]">
            $ stylesync pack &lt;ref_id&gt;
          </code>{' '}
          — click to copy this command to your clipboard. Run it from inside any project on your own computer to
          generate a Style Pack there. See{' '}
          <Link href="/help/applying-styles" className="text-[var(--color-accent)] hover:underline">
            Applying styles
          </Link>
          .
        </li>
        <li id="brand-guide" className="scroll-mt-24">
          <strong className="text-[var(--color-fg)]">↓ Brand guidelines (PDF)</strong> — downloads a polished PDF
          summarising this design&rsquo;s palette, typography, spacing, and shape, with the captured screenshot as a
          cover image. Useful for sharing with a client, a teammate, or a designer who doesn&rsquo;t need (or want) to
          dig through raw token files.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">⇄ Restyle a repo (PR)</strong> — opens a form to apply this
          style to a GitHub repository automatically, as a pull request you review before merging. Full walkthrough
          on the{' '}
          <Link href="/help/applying-styles#restyle-via-pr" className="text-[var(--color-accent)] hover:underline">
            Applying styles
          </Link>{' '}
          page.
        </li>
      </ul>

      <h3 className="mb-2 mt-6 text-sm font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">The Tokens tab</h3>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Every raw design value StyleSync extracted, laid out for reading:
      </p>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <strong className="text-[var(--color-fg)]">Colour ramps</strong> — each palette role (primary, neutral,
          accent) as a full range from light to dark, plus the minimum body-text contrast ratio and whether it passes
          the WCAG AA accessibility standard (auto-corrected if it didn&rsquo;t, so you always get an accessible
          result).
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Fonts</strong> — the display and body typefaces, with a live
          preview rendered in the actual font where it can be loaded from Google Fonts.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Type scale</strong> — every text size the design uses, from
          smallest to largest, shown at actual size.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Spacing</strong> — the underlying spacing rhythm (margins,
          padding, gaps) as a visual scale.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Radii & elevation</strong> — corner rounding at every size the
          design uses, from sharp to fully rounded.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Layout & navigation</strong> — whether the design uses a sidebar
          or top navigation bar, how content is aligned, and notes on the logo placement, header, footer, and primary
          button style.
        </li>
      </ul>

      <h3 className="mb-2 mt-6 text-sm font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">The Components tab</h3>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        This is where the tokens above are put together into actual, working components — a real button, badge, input
        field, and card, rendered live using this reference&rsquo;s own extracted recipe. Hover the primary button to
        see its real hover-state transition, captured directly from the source. If this tab looks empty, it usually
        means the reference&rsquo;s confidence is low, or it was captured via the vision-inferred method (Banani),
        which doesn&rsquo;t always produce full component recipes.
      </p>

      <h3 className="mb-2 mt-6 text-sm font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">The Provenance tab</h3>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        The paper trail for this reference — which source it came from, a link back to the original page, credit for
        its creator where known, exactly which extraction method was used, its confidence score, and when it was
        captured. Worth checking before you credit or publish anything based on a reference.
      </p>
    </div>
  );
}
