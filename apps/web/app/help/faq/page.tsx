import Link from 'next/link';

export const metadata = { title: 'FAQ & troubleshooting — StyleSync Help' };

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 border-b border-[var(--color-border)] pb-6 last:border-b-0">
      <h3 className="mb-2 text-sm font-medium text-[var(--color-fg)]">{q}</h3>
      <div className="text-sm leading-relaxed text-[var(--color-fg-muted)]">{children}</div>
    </div>
  );
}

export default function FaqHelpPage() {
  return (
    <div className="max-w-[820px]">
      <h1 className="mb-2 text-2xl font-semibold">FAQ & troubleshooting</h1>
      <p className="mb-8 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Straight answers to the questions people ask most often. If something here doesn&rsquo;t cover your
        situation, the other Help pages go into much more depth on each topic.
      </p>

      <QA q="Do I need to install anything to use StyleSync?">
        <p>
          No, not to browse the library, view a reference&rsquo;s full breakdown, download a Brand Guidelines PDF, or
          open a Restyle via PR pull request — all of that works from the website. You only need to install the CLI
          locally if you want to generate a Style Pack and run the deterministic code transform directly on a project
          on your own machine. See{' '}
          <Link href="/help/getting-started" className="text-[var(--color-accent)] hover:underline">
            Getting started
          </Link>
          .
        </p>
      </QA>

      <QA q="Which API key do I need — Anthropic or Gemini?">
        <p>
          Only if you want the Banani source to work (it&rsquo;s the only one that reads a screenshot with an AI
          vision model instead of real page CSS). You need <em>either</em> <code className="font-mono-token">ANTHROPIC_API_KEY</code>{' '}
          or <code className="font-mono-token">GEMINI_API_KEY</code>, not both — whichever you set is used. Every
          other source works without either key.
        </p>
      </QA>

      <QA q="What does &ldquo;confidence&rdquo; mean, and why does it vary so much?">
        <p>
          It&rsquo;s a 0&ndash;1 score of how sure StyleSync is about the values it extracted for a reference, and it
          depends on how that reference was captured: real Figma variables score highest, real computed CSS from a
          live page scores well and varies with how much of the page could be read, and an AI reading a screenshot
          scores more conservatively since it&rsquo;s inherently an estimate. Full breakdown on{' '}
          <Link href="/help/reference-detail#confidence" className="text-[var(--color-accent)] hover:underline">
            Working with a reference
          </Link>
          .
        </p>
      </QA>

      <QA q="A source shows 'unhealthy' or 'never synced' — what do I do?">
        <p>
          Hover the red status dot on the{' '}
          <Link href="/help/sources" className="text-[var(--color-accent)] hover:underline">
            Sources page
          </Link>{' '}
          to see the reason. The most common cause is a missing API key or token — if so, an orange &ldquo;Needs
          setup&rdquo; banner appears underneath the source with a direct link to get the key and where to add it.
          &ldquo;Never synced&rdquo; just means it hasn&rsquo;t run yet — click{' '}
          <strong className="text-[var(--color-fg)]">Sync now</strong> to trigger it.
        </p>
      </QA>

      <QA q="Can I add a site that isn't in the built-in source list?">
        <p>
          Yes — paste its URL into the Ad-hoc URL capture box at the bottom of the{' '}
          <Link href="/help/sources" className="text-[var(--color-accent)] hover:underline">
            Sources page
          </Link>{' '}
          and click Capture. It&rsquo;s treated exactly like any other reference once captured.
        </p>
      </QA>

      <QA q="What's the difference between 'Sync now' and 'Full re-sync'?">
        <p>
          <strong className="text-[var(--color-fg)]">Sync now</strong> is a delta sync — it skips anything unchanged
          since last time, so it&rsquo;s fast. <strong className="text-[var(--color-fg)]">Full re-sync</strong>{' '}
          rechecks every item from scratch, ignoring that shortcut. Reach for a full re-sync if you suspect something
          was captured wrong, or after fixing how a source is configured.
        </p>
      </QA>

      <QA q="Will StyleSync change my code without asking first?">
        <p>
          No. The CLI&rsquo;s <code className="font-mono-token">apply --deterministic</code> refuses to run unless
          your project is a clean git repository, precisely so every change is reviewable with{' '}
          <code className="font-mono-token">git diff</code> and reversible with{' '}
          <code className="font-mono-token">git checkout .</code> before you commit anything. Restyle via PR never
          touches your repository directly at all — it only opens a pull request, which you review and merge (or
          close) yourself on GitHub.
        </p>
      </QA>

      <QA q="The deterministic apply changed colours and spacing, but the layout still looks off — is that a bug?">
        <p>
          No — that&rsquo;s by design. The deterministic transform deliberately never restructures layout or
          individually polishes each component, because that requires judgement a code transform can&rsquo;t safely
          automate. For that last mile, use the Claude Code restyle skill described on{' '}
          <Link href="/help/applying-styles" className="text-[var(--color-accent)] hover:underline">
            Applying styles
          </Link>
          , or adjust the transform&rsquo;s scope with <code className="font-mono-token">--only</code>,{' '}
          <code className="font-mono-token">--intensity</code>, and <code className="font-mono-token">--preserve-brand</code>.
        </p>
      </QA>

      <QA q="Is my GitHub token or API key stored anywhere?">
        <p>
          A GitHub token entered into the Restyle via PR form is used for that one request only, to call GitHub&rsquo;s
          API on your behalf, and is never stored or logged. <code className="font-mono-token">ANTHROPIC_API_KEY</code>{' '}
          and <code className="font-mono-token">GEMINI_API_KEY</code> are ordinary environment variables / repository
          secrets you set yourself for the sync worker to use — StyleSync doesn&rsquo;t collect or transmit them
          anywhere beyond calling that provider&rsquo;s own API during a capture.
        </p>
      </QA>

      <QA q="Where do I go to actually try each feature?">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <Link href="/help/getting-started" className="text-[var(--color-accent)] hover:underline">
              Getting started
            </Link>{' '}
            — install, environment variables, your first sync.
          </li>
          <li>
            <Link href="/help/sources" className="text-[var(--color-accent)] hover:underline">
              Sources & syncing
            </Link>{' '}
            — every built-in source, plus capturing any page yourself.
          </li>
          <li>
            <Link href="/help/reference-detail" className="text-[var(--color-accent)] hover:underline">
              Working with a reference
            </Link>{' '}
            — the library grid, confidence, and all three DRP tabs.
          </li>
          <li>
            <Link href="/help/applying-styles" className="text-[var(--color-accent)] hover:underline">
              Applying styles to your project
            </Link>{' '}
            — all four ways to use a style, compared.
          </li>
          <li>
            <Link href="/help/cli-reference" className="text-[var(--color-accent)] hover:underline">
              CLI reference
            </Link>{' '}
            — every terminal command.
          </li>
        </ul>
      </QA>
    </div>
  );
}
