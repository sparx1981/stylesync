import Link from 'next/link';

export const metadata = { title: 'CLI reference — StyleSync Help' };

function CmdSection({
  cmd,
  title,
  children,
  example,
}: {
  cmd: string;
  title: string;
  children: React.ReactNode;
  example: string;
}) {
  return (
    <div className="mb-8">
      <h3 className="mb-1 flex items-baseline gap-2 text-sm font-medium">
        <code className="font-mono-token rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[var(--color-fg)]">
          {cmd}
        </code>
        <span className="text-[var(--color-fg-subtle)]">— {title}</span>
      </h3>
      <p className="mb-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{children}</p>
      <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono-token text-xs text-[var(--color-fg)]">
        {example}
      </pre>
    </div>
  );
}

export default function CliReferenceHelpPage() {
  return (
    <div className="max-w-[820px]">
      <h1 className="mb-2 text-2xl font-semibold">CLI reference</h1>
      <p className="mb-8 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Every command the <code className="font-mono-token">stylesync</code> CLI supports. See{' '}
        <Link href="/help/getting-started" className="text-[var(--color-accent)] hover:underline">
          Getting started
        </Link>{' '}
        for installation. Once installed globally, drop the{' '}
        <code className="font-mono-token">pnpm --filter @stylesync/cli exec</code> prefix and run{' '}
        <code className="font-mono-token">stylesync ...</code> directly — the examples below use the short form.
      </p>

      <CmdSection cmd="stylesync sync" title="capture new or changed references" example={`stylesync sync                          # every source
stylesync sync --source figma           # just one source
stylesync sync --full                   # ignore the "unchanged" shortcut, recheck everything
stylesync sync --add https://example.com  # capture one specific page`}>
        Visits every enabled source (or one, with <code className="font-mono-token">--source</code>) and captures
        anything new or changed. <code className="font-mono-token">--add &lt;url&gt;</code> captures a single ad-hoc
        page instead, the same as the Ad-hoc URL box on the website.
      </CmdSection>

      <CmdSection cmd="stylesync doctor" title="check adapter health and find problems" example={`stylesync doctor`}>
        Prints each source&rsquo;s health status, any references stuck in a partial or failed state, and how many
        references don&rsquo;t have a DRP built yet. The first thing to run if something seems off.
      </CmdSection>

      <CmdSection cmd="stylesync search <query>" title="search your library from the terminal" example={`stylesync search "dark dashboard"
stylesync search "landing" --source lapa-ninja
stylesync search "saas" --tag minimal`}>
        Full-text search across titles and tags, with each result&rsquo;s confidence shown alongside it.{' '}
        <code className="font-mono-token">--source</code> and <code className="font-mono-token">--tag</code> narrow
        the results.
      </CmdSection>

      <CmdSection cmd="stylesync show <ref_id>" title="print a reference's full DRP summary" example={`stylesync show ref_lapaninja_some-slug`}>
        Prints the same information as the reference detail page&rsquo;s Tokens tab, as plain text — palette, type
        scale, spacing, elevation strategy, and anti-patterns.
      </CmdSection>

      <CmdSection cmd="stylesync pack <ref_id>" title="generate a Style Pack into the current directory" example={`cd ~/code/my-app
stylesync pack ref_lapaninja_some-slug
stylesync pack ref_lapaninja_some-slug --out design`}>
        Writes <code className="font-mono-token">STYLEPACK.md</code>, <code className="font-mono-token">tokens.css</code>,{' '}
        <code className="font-mono-token">tailwind.theme.ts</code>, <code className="font-mono-token">tokens.json</code>,
        and <code className="font-mono-token">components.md</code> into <code className="font-mono-token">./.stylesync</code>{' '}
        (or wherever <code className="font-mono-token">--out</code> points). This is always the first step before{' '}
        <code className="font-mono-token">apply</code>. See{' '}
        <Link href="/help/applying-styles" className="text-[var(--color-accent)] hover:underline">
          Applying styles
        </Link>{' '}
        for what to do with the result.
      </CmdSection>

      <CmdSection cmd="stylesync brand-guide <ref_id>" title="generate a Brand Guidelines PDF" example={`stylesync brand-guide ref_lapaninja_some-slug
stylesync brand-guide ref_lapaninja_some-slug --out ~/Desktop/brand-guide.pdf`}>
        Generates the same PDF as the &ldquo;↓ Brand guidelines&rdquo; button on the website, written to{' '}
        <code className="font-mono-token">brand-guide.pdf</code> in the current directory (or wherever{' '}
        <code className="font-mono-token">--out</code> points).
      </CmdSection>

      <CmdSection cmd="stylesync apply --deterministic" title="run the automatic code transform" example={`stylesync apply --deterministic
stylesync apply --deterministic --dry-run
stylesync apply --deterministic --only colors,radius
stylesync apply --deterministic --intensity conservative
stylesync apply --deterministic --preserve-brand "#1a2b3c,#ffcc00"`}>
        Rewrites colours, radius, shadow, spacing, motion timing, and Tailwind class names across your project to
        match the packed Style Pack. Requires a clean git working tree (pass <code className="font-mono-token">--force</code>{' '}
        at your own risk to skip that check). Full option reference on the{' '}
        <Link href="/help/applying-styles" className="text-[var(--color-accent)] hover:underline">
          Applying styles
        </Link>{' '}
        page.
      </CmdSection>

      <CmdSection cmd="stylesync shots" title="capture before/after screenshots" example={`# with your dev server already running:
stylesync shots
stylesync shots --routes /,/pricing,/about
stylesync shots --base-url http://localhost:3000`}>
        Screenshots the given routes (comma-separated, defaults to just <code className="font-mono-token">/</code>)
        against your already-running dev server, writing them to{' '}
        <code className="font-mono-token">.stylesync/shots/</code> — handy for a visual gut-check after{' '}
        <code className="font-mono-token">apply</code>.
      </CmdSection>

      <CmdSection cmd="stylesync history" title="see what was applied where, and when" example={`stylesync history
stylesync history --project ~/code/my-app`}>
        Lists every Style Pack you&rsquo;ve generated, which reference it came from, which project it was written
        into, and when.
      </CmdSection>

      <CmdSection cmd="stylesync web" title="start the local library UI" example={`stylesync web`}>
        Starts the Next.js library UI on <code className="font-mono-token">http://localhost:4321</code>, backed by
        your local database — the same interface as the hosted site, running on your own machine.
      </CmdSection>

      <h2 className="mb-3 mt-10 text-lg font-medium">Global options</h2>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <code className="font-mono-token">--json</code> — machine-readable output, where a command supports it.
        </li>
        <li>
          <code className="font-mono-token">--force</code> — skip safety preconditions, such as the clean-git-tree
          check before <code className="font-mono-token">apply</code>. Use with care.
        </li>
      </ul>
    </div>
  );
}
