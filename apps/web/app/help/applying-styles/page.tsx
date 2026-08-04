import Link from 'next/link';

export const metadata = { title: 'Applying styles to your project — StyleSync Help' };

export default function ApplyingStylesHelpPage() {
  return (
    <div className="max-w-[820px]">
      <h1 className="mb-2 text-2xl font-semibold">Applying styles to your project</h1>
      <p className="mb-8 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Once you&rsquo;ve found a reference you like, there are four different ways to actually bring its style into
        your own project. They trade off convenience against control — this page walks through each one so you can
        pick the right one for what you&rsquo;re doing.
      </p>

      <div className="mb-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-fg-subtle)]">
              <th className="py-2 pr-4 font-normal">Method</th>
              <th className="py-2 pr-4 font-normal">Needs install?</th>
              <th className="py-2 pr-4 font-normal">Best for</th>
            </tr>
          </thead>
          <tbody className="text-[var(--color-fg-muted)]">
            <tr className="border-b border-[var(--color-border)]">
              <td className="py-2 pr-4 font-medium text-[var(--color-fg)]">Restyle via PR</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2 pr-4">Quick trial on a real repo, no terminal needed.</td>
            </tr>
            <tr className="border-b border-[var(--color-border)]">
              <td className="py-2 pr-4 font-medium text-[var(--color-fg)]">CLI deterministic apply</td>
              <td className="py-2 pr-4">Yes</td>
              <td className="py-2 pr-4">Full control over which changes are made, reviewed locally.</td>
            </tr>
            <tr className="border-b border-[var(--color-border)]">
              <td className="py-2 pr-4 font-medium text-[var(--color-fg)]">Claude Code restyle skill</td>
              <td className="py-2 pr-4">Yes (+ Claude Code)</td>
              <td className="py-2 pr-4">The best-fidelity result, including layout and component polish.</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium text-[var(--color-fg)]">Manual / by hand</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2 pr-4">Any stack, including projects StyleSync&rsquo;s tooling can&rsquo;t touch.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="restyle-via-pr" className="mb-3 mt-10 scroll-mt-24 text-lg font-medium">1. Restyle via PR — the easiest option</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        This is the fastest way to see a style applied to a real project, and it doesn&rsquo;t require installing
        anything. From any reference&rsquo;s detail page:
      </p>
      <ol className="mb-4 ml-5 list-decimal space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          Click <strong className="text-[var(--color-fg)]">⇄ Restyle a repo (PR)</strong>. A small form expands.
        </li>
        <li>
          Enter the target repository as <code className="font-mono-token">owner/name</code> (for example,{' '}
          <code className="font-mono-token">yourname/your-app</code>) — it must be a repo you have push access to.
        </li>
        <li>
          Paste a GitHub personal access token with <code className="font-mono-token">Contents</code> and{' '}
          <code className="font-mono-token">Pull requests</code> write permission. The easiest way to create one:
          GitHub &rarr; Settings &rarr; Developer settings &rarr; Personal access tokens &rarr; Fine-grained tokens
          &rarr; scope it to just that one repository with those two permissions.
        </li>
        <li>Optionally set a base branch — it defaults to the repository&rsquo;s default branch if you leave it blank.</li>
        <li>
          Click <strong className="text-[var(--color-fg)]">Open PR</strong>.
        </li>
      </ol>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Behind the scenes, StyleSync downloads a copy of your repository, runs exactly the same deterministic
        transform described below, and opens a pull request with the result — colours mapped to the nearest palette
        token, corner radius/shadow/spacing snapped to the nearest matching scale value, and a generated{' '}
        <code className="font-mono-token">.stylesync/tokens.css</code> wired in. You then review the diff on GitHub
        like any other pull request, and merge it or close it — nothing touches your repository until you do.
      </p>
      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-raised)] p-4 text-sm text-[var(--color-fg-muted)]">
        <strong className="text-[var(--color-fg)]">About your token.</strong> It&rsquo;s sent to StyleSync&rsquo;s
        server for that one request only, used purely to call the GitHub API on your behalf, and is never stored or
        logged anywhere.
      </div>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        This method covers the same &ldquo;deterministic&rdquo; ground as the CLI&rsquo;s{' '}
        <code className="font-mono-token">apply --deterministic</code> — it does <em>not</em> restructure layout or
        individually polish each component. For that, see the Claude Code skill below.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">2. CLI deterministic apply — full local control</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Once you&rsquo;ve{' '}
        <Link href="/help/getting-started" className="text-[var(--color-accent)] hover:underline">
          installed the CLI locally
        </Link>
        , this runs the same transform as Restyle via PR, but on your own machine, with fine-grained control over
        what gets touched.
      </p>
      <pre className="mb-4 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono-token text-xs text-[var(--color-fg)]">
{`cd ~/code/my-app
git checkout -b restyle          # work on a branch so it's easy to compare/undo

stylesync pack <ref_id>          # writes a Style Pack into ./.stylesync
stylesync apply --deterministic  # runs the code transform

git diff                         # review every change
git checkout .                   # ...or undo everything, instantly`}
      </pre>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        <code className="font-mono-token">apply</code> refuses to run unless your project is a clean git repository —
        that&rsquo;s deliberate, since git is the entire undo mechanism. Useful options:
      </p>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <code className="font-mono-token">--dry-run</code> — show what would change without writing anything.
        </li>
        <li>
          <code className="font-mono-token">--only colors,radius,shadow,spacing,motion,classes,tokens</code> — limit
          the transform to specific categories (comma-separated).
        </li>
        <li>
          <code className="font-mono-token">--intensity conservative | balanced | bold</code> — how aggressively
          values are remapped. Defaults to <code className="font-mono-token">balanced</code>.
        </li>
        <li>
          <code className="font-mono-token">--preserve-brand #hex,#hex</code> — hex colours to leave untouched (your
          logo colour, say).
        </li>
      </ul>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        What it changes: colour literals, border-radius, box-shadow, spacing values, transition timing, and Tailwind
        class names inside JSX <code className="font-mono-token">className</code> strings. What it deliberately
        doesn&rsquo;t touch: component layout, structure, or any logic — see method 3 for that.
      </p>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Run <code className="font-mono-token">stylesync shots</code> afterwards (with your dev server running) to
        capture before/after screenshots into <code className="font-mono-token">.stylesync/shots/</code>, and{' '}
        <code className="font-mono-token">stylesync history</code> any time to see what was applied where and when.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">3. Claude Code restyle skill — the last mile</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        The deterministic transform above handles the mechanical part of a restyle well — but it deliberately never
        touches layout or restructures a component, because that requires judgement a code transform can&rsquo;t
        safely automate. If you use{' '}
        <a href="https://claude.com/product/claude-code" target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
          Claude Code
        </a>
        , StyleSync ships a skill that handles exactly that gap:
      </p>
      <ol className="mb-4 ml-5 list-decimal space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          Run <code className="font-mono-token">stylesync pack &lt;ref_id&gt;</code> in your project first (or run
          <code className="font-mono-token">apply --deterministic</code> too, if you want to start from that baseline).
        </li>
        <li>
          Copy <code className="font-mono-token">packages/skill/.claude/skills/restyle</code> from the StyleSync repo
          into your project&rsquo;s <code className="font-mono-token">.claude/skills/</code> folder.
        </li>
        <li>
          Open Claude Code in your project and ask it to restyle the project — with{' '}
          <code className="font-mono-token">.stylesync/STYLEPACK.md</code> present, the skill triggers automatically.
        </li>
      </ol>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        The skill works through your components one at a time, applying each one&rsquo;s exact recipe (colours,
        radius, padding, font) from <code className="font-mono-token">components.md</code>, adding proper hover,
        active, focus, and disabled states, and checking every change against the design&rsquo;s own written
        anti-patterns — all with a real dev server running so it can actually see the result. This is the closest
        you&rsquo;ll get to a human designer&rsquo;s pass, and it&rsquo;s the recommended finishing step after either
        of the deterministic methods above.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">4. Manual — copy the values in by hand</h2>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Every Style Pack is just plain files — nothing stops you from opening them yourself and copying values into
        any project, including ones StyleSync&rsquo;s automated tooling can&rsquo;t reach (a WordPress theme, a mobile
        app, a design tool). After running <code className="font-mono-token">stylesync pack &lt;ref_id&gt;</code>,
        you&rsquo;ll find:
      </p>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>
          <code className="font-mono-token">STYLEPACK.md</code> — a written brief explaining the design system in
          plain language, meant to be read by a person or handed to any coding agent.
        </li>
        <li>
          <code className="font-mono-token">tokens.css</code> — every token as a CSS custom property, ready to{' '}
          <code className="font-mono-token">@import</code> directly.
        </li>
        <li>
          <code className="font-mono-token">tailwind.theme.ts</code> — the same tokens shaped for a Tailwind config.
        </li>
        <li>
          <code className="font-mono-token">tokens.json</code> — the raw values, for anything else that wants to read
          them programmatically.
        </li>
        <li>
          <code className="font-mono-token">components.md</code> — exact recipes (colour, radius, padding, font) for
          buttons, cards, inputs, and other common component roles.
        </li>
      </ul>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        This is also the best way to <em>understand</em> what the other three methods are doing under the hood, if
        you&rsquo;re curious.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-medium">Which one should I use?</h2>
      <ul className="mb-4 ml-5 list-disc space-y-2 text-sm text-[var(--color-fg-muted)]">
        <li>Just want to see what it looks like on a real repo, fast, no setup? &rarr; Restyle via PR.</li>
        <li>Comfortable with git and want to review changes locally before committing? &rarr; CLI deterministic apply.</li>
        <li>Want the highest-quality, most complete result and you use Claude Code? &rarr; Add the restyle skill on top.</li>
        <li>Working outside a typical JS/CSS project, or just want to hand-pick values? &rarr; Manual.</li>
      </ul>
      <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Every method except Restyle via PR (which works on a throwaway copy of your repo) is backed by git locally —
        if anything doesn&rsquo;t look right, <code className="font-mono-token">git checkout .</code> puts you back
        exactly where you started.
      </p>
    </div>
  );
}
