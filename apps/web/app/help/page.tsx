import Link from 'next/link';

export const metadata = { title: 'Help — StyleSync' };

function Card({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]"
    >
      <span className="text-sm font-medium text-[var(--color-fg)]">{title}</span>
      <span className="text-xs text-[var(--color-fg-muted)]">{children}</span>
    </Link>
  );
}

export default function HelpIndexPage() {
  return (
    <div className="max-w-[820px]">
      <h1 className="mb-2 text-2xl font-semibold">Help</h1>
      <p className="mb-8 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        StyleSync turns a website or app you admire into a real, usable design system — colours, type, spacing, shape,
        motion, and even ready-made component recipes — and then helps you bring as much of that into your own project
        as possible, automatically. This page is a complete guide to everything StyleSync can do, written for people
        who have never used it before.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">What problem does this solve?</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Most people start a new project with a blank stylesheet and a vague idea like &ldquo;I want it to feel like
        Linear&rdquo; or &ldquo;something clean and dark, like Vercel&rsquo;s site.&rdquo; Turning that feeling into
        actual hex codes, font stacks, spacing values, and button styles is slow, and it&rsquo;s easy to end up with
        something that&rsquo;s only vaguely similar to what you had in mind.
      </p>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        StyleSync does that translation for you. Point it at a site (or pick one from its built-in library), and it
        captures the site&rsquo;s real, live styling — actual computed CSS where possible, not a guess — and turns it
        into a structured, portable set of design tokens. From there you can hand that off to your coding agent, run
        an automatic code transform on your own project, or just use it as a reference while you build by hand.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">Who this is for</h2>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <strong className="text-[var(--color-fg)]">Builders who want a head start</strong> — instead of staring at a
          blank Tailwind config, start from a real, working design system extracted from a site you already like.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">People restyling an existing project</strong> — apply a new look
          to code you already have, either as a one-click pull request or as a local code transform you review before
          committing.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Anyone who needs a brand guide</strong> — generate a polished PDF
          summary of a design&rsquo;s palette, type, and spacing to share with a client, teammate, or designer.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">People who just want to learn</strong> — browse real, working
          examples of how other products actually use colour, spacing, and type, with the exact values laid out.
        </li>
      </ul>

      <h2 className="mb-3 mt-10 text-lg font-medium">How it all fits together</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Every reference in your library goes through the same four stages:
      </p>
      <ol className="mb-4 ml-5 list-decimal space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <strong className="text-[var(--color-fg)]">Capture</strong> — StyleSync visits a site (or a Figma file, or a
          screenshot) and records what&rsquo;s actually there: rendered CSS, fonts, colours, spacing, even how buttons
          change on hover.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Analyse</strong> — that raw capture is turned into a structured
          &ldquo;Design Reference Profile&rdquo; (DRP): a real colour palette, a type scale, a spacing system, border
          radii, shadows, motion timing, and component recipes for things like buttons, cards, and inputs.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Package</strong> — the DRP is rendered into a &ldquo;Style
          Pack&rdquo;: plain files (CSS custom properties, a Tailwind theme, JSON tokens, and a written brief) that
          any coding agent or developer can read and use.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Apply</strong> — you bring that style into your own project,
          using whichever of the several methods on the{' '}
          <Link href="/help/applying-styles" className="text-[var(--color-accent)] hover:underline">
            Applying styles
          </Link>{' '}
          page suits you best.
        </li>
      </ol>

      <h2 className="mb-3 mt-10 text-lg font-medium">Common scenarios</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        A few concrete examples of how people actually use StyleSync day to day — each links to the full walkthrough:
      </p>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <strong className="text-[var(--color-fg)]">&ldquo;I found a site I love and want mine to look like it.&rdquo;</strong>{' '}
          Paste its URL into the Ad-hoc URL capture box on the{' '}
          <Link href="/help/sources" className="text-[var(--color-accent)] hover:underline">
            Sources page
          </Link>
          , wait for it to appear in your library, then open it and use one of the{' '}
          <Link href="/help/applying-styles" className="text-[var(--color-accent)] hover:underline">
            apply methods
          </Link>
          .
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">&ldquo;I want to restyle my repo without touching a terminal.&rdquo;</strong>{' '}
          Open any reference and use{' '}
          <Link href="/help/applying-styles#restyle-via-pr" className="text-[var(--color-accent)] hover:underline">
            Restyle via PR
          </Link>{' '}
          — it opens a pull request on your GitHub repo for you to review and merge.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">&ldquo;I need a brand guide to send a client.&rdquo;</strong>{' '}
          Open a reference and download its{' '}
          <Link href="/help/reference-detail#brand-guide" className="text-[var(--color-accent)] hover:underline">
            Brand guidelines PDF
          </Link>
          .
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">&ldquo;I want full control and I&rsquo;m comfortable with the terminal.&rdquo;</strong>{' '}
          Install the CLI locally and use{' '}
          <Link href="/help/cli-reference" className="text-[var(--color-accent)] hover:underline">
            stylesync pack + apply
          </Link>
          , reviewing every change with <code className="font-mono-token">git diff</code> before committing.
        </li>
      </ul>

      <h2 className="mb-4 mt-10 text-lg font-medium">Where to go next</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card href="/help/getting-started" title="Getting started">
          Do you need to install anything? Environment variables, your first sync, and what confidence means.
        </Card>
        <Card href="/help/sources" title="Sources & syncing">
          Every built-in source explained, plus how to capture any page yourself with the Ad-hoc URL box.
        </Card>
        <Card href="/help/reference-detail" title="Working with a reference">
          The library grid, the reference detail page, the three DRP tabs, and the brand guide PDF.
        </Card>
        <Card href="/help/applying-styles" title="Applying styles to your project">
          Four different ways to actually use a style — from a one-click PR to full manual control.
        </Card>
        <Card href="/help/cli-reference" title="CLI reference">
          Every terminal command, what it does, and when you&rsquo;d reach for it.
        </Card>
        <Card href="/help/faq" title="FAQ & troubleshooting">
          Straight answers to the questions people ask most often.
        </Card>
      </div>
    </div>
  );
}
