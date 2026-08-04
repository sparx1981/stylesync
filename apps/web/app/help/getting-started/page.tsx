import Link from 'next/link';

export const metadata = { title: 'Getting started — StyleSync Help' };

export default function GettingStartedPage() {
  return (
    <div className="max-w-[820px]">
      <h1 className="mb-2 text-2xl font-semibold">Getting started</h1>
      <p className="mb-8 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        The short version: if you&rsquo;re reading this on the website, you can already browse the library, download
        brand guides, and open restyle pull requests without installing anything. You only need to install anything
        locally if you want to generate style packs from the terminal or apply a style directly to a project on your
        own computer.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">Two ways to use StyleSync</h2>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-1 text-sm font-medium text-[var(--color-fg)]">Just the website</h3>
          <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
            Nothing to install. Browse the library, view a reference&rsquo;s full design breakdown, download a Brand
            Guidelines PDF, or open an automatic &ldquo;Restyle via PR&rdquo; pull request on any repo you have push
            access to. This covers most people&rsquo;s needs.
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-1 text-sm font-medium text-[var(--color-fg)]">The CLI, on your own machine</h3>
          <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
            Install the <code className="font-mono-token">stylesync</code> command locally to generate a Style Pack
            into any project folder and run the deterministic code transform yourself, with every change reviewable
            with <code className="font-mono-token">git diff</code> before you commit it.
          </p>
        </div>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        You can mix both: capture references and browse on the website, then use the CLI locally only for the{' '}
        <code className="font-mono-token">apply</code> step when you&rsquo;re ready to bring a style into a real
        project. See{' '}
        <Link href="/help/applying-styles" className="text-[var(--color-accent)] hover:underline">
          Applying styles
        </Link>{' '}
        for a full comparison of every option.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">Installing the CLI locally</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        You&rsquo;ll need <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">Node.js</a> installed. Then, from a clone of the StyleSync repository:
      </p>
      <pre className="mb-4 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono-token text-xs text-[var(--color-fg)]">
{`corepack enable                  # or: npm i -g pnpm
pnpm install
pnpm build                       # compiles the CLI — required once before "stylesync" works`}
      </pre>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        If you plan to run <code className="font-mono-token">stylesync apply</code> against a project, that project
        needs to be a git repository with a clean working tree first — git is StyleSync&rsquo;s safety net, since it
        refuses to run without something to revert to. If it isn&rsquo;t one yet:
      </p>
      <pre className="mb-4 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono-token text-xs text-[var(--color-fg)]">
{`cd ~/code/my-app
git init
git add -A && git commit -m "before restyle"`}
      </pre>

      <h2 className="mb-3 mt-10 text-lg font-medium">Environment variables</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        None of these are required to browse the hosted library. They only matter if you&rsquo;re running syncs
        yourself (locally or via the GitHub Actions worker behind the hosted site) and want a particular source to
        work.
      </p>
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-fg-subtle)]">
            <th className="py-2 font-normal">Variable</th>
            <th className="py-2 font-normal">Unlocks</th>
          </tr>
        </thead>
        <tbody className="text-[var(--color-fg-muted)]">
          <tr className="border-b border-[var(--color-border)]">
            <td className="py-2 font-mono-token text-xs">FIGMA_TOKEN</td>
            <td className="py-2">
              The Figma Community source — captures real design variables straight from Figma&rsquo;s API, which gives
              the highest-confidence results StyleSync can produce.
            </td>
          </tr>
          <tr className="border-b border-[var(--color-border)]">
            <td className="py-2 font-mono-token text-xs">ANTHROPIC_API_KEY</td>
            <td className="py-2">
              The Banani source (and any other vision-based capture), by asking Claude to read a screenshot and
              describe its design. You only need <em>either</em> this or the key below, not both.
            </td>
          </tr>
          <tr className="border-b border-[var(--color-border)]">
            <td className="py-2 font-mono-token text-xs">GEMINI_API_KEY</td>
            <td className="py-2">
              The same vision-based capture as above, using Google Gemini instead of Claude. Handy if you&rsquo;d
              rather not use an Anthropic key, or already have a Gemini one. Get one free at{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
                aistudio.google.com/apikey
              </a>
              .
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Set them as normal shell environment variables locally (<code className="font-mono-token">export FIGMA_TOKEN=...</code>),
        or as repository secrets in GitHub Actions if you&rsquo;re running the hosted sync worker — the{' '}
        <Link href="/help/sources" className="text-[var(--color-accent)] hover:underline">
          Sources page
        </Link>{' '}
        will tell you exactly which ones a source is missing and link you straight to where to get each one.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">Your first sync</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        &ldquo;Syncing&rdquo; is what StyleSync calls visiting a source&rsquo;s sites and capturing anything new or
        changed. If you&rsquo;re using the hosted website, this already happens automatically on a schedule — you can
        also trigger it manually from the{' '}
        <Link href="/help/sources" className="text-[var(--color-accent)] hover:underline">
          Sources page
        </Link>
        . If you&rsquo;re running locally:
      </p>
      <pre className="mb-4 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono-token text-xs text-[var(--color-fg)]">
{`pnpm cli sync`}
      </pre>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        This is a <strong className="text-[var(--color-fg)]">delta sync</strong> — it only captures items that are new
        or have actually changed since last time, so re-running it often is cheap. See{' '}
        <Link href="/help/sources" className="text-[var(--color-accent)] hover:underline">
          Sources & syncing
        </Link>{' '}
        for the difference between this and a full re-sync.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">Browsing your library</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        On the hosted site, the library is the home page. Running locally, start it with:
      </p>
      <pre className="mb-4 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono-token text-xs text-[var(--color-fg)]">
{`pnpm cli web`}
      </pre>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        then open <code className="font-mono-token">http://localhost:4321</code>. Either way, you&rsquo;ll land on the
        same grid of captured references — see{' '}
        <Link href="/help/reference-detail" className="text-[var(--color-accent)] hover:underline">
          Working with a reference
        </Link>{' '}
        for a full tour of what you can do from there.
      </p>

      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-raised)] p-4 text-sm text-[var(--color-fg-muted)]">
        <strong className="text-[var(--color-fg)]">A note on &ldquo;confidence.&rdquo;</strong> Every reference shows a
        small coloured dot with a number from 0 to 1 next to it. That&rsquo;s how sure StyleSync is about the values it
        extracted, and it depends entirely on how the reference was captured — real design files score highest, a real
        live website scores well, and a screenshot read by an AI vision model scores more conservatively. The{' '}
        <Link href="/help/reference-detail" className="text-[var(--color-accent)] hover:underline">
          Working with a reference
        </Link>{' '}
        page explains exactly how it&rsquo;s calculated.
      </div>
    </div>
  );
}
