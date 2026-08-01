import Link from 'next/link';
import { getDb } from '../lib/db';
import { RefCard } from '../components/RefCard';
import type { DRP } from '@stylesync/core';

export const dynamic = 'force-dynamic'; // always read the live SQLite state — this is a localhost tool, not a CDN-cached site

interface PageProps {
  searchParams: Promise<{ q?: string; source?: string; favorite?: string }>;
}

export default async function LibraryPage({ searchParams }: PageProps) {
  const { q, source, favorite } = await searchParams;
  const db = getDb();

  const sources = db.listSources();
  let refs = q ? db.searchRefs(q) : db.listRefs({ source, favorite: favorite === '1' });
  if (q && source) refs = refs.filter((r) => r.source_id === source);

  const drpByRef = new Map<string, DRP>();
  for (const r of refs) {
    const row = db.getDrp(r.id);
    if (row) drpByRef.set(r.id, JSON.parse(row.profile));
  }

  const hasAnySource = sources.length > 0;

  return (
    <div className="mx-auto flex max-w-[1400px] gap-8 px-6 py-8">
      {/* Filter rail (spec §11.1) */}
      <aside className="hidden w-56 shrink-0 flex-col gap-6 md:flex">
        <form action="/" className="flex flex-col gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="dark data-dense dashboard…"
            className="font-mono-token rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
          />
        </form>

        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">Source</h3>
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <Link href="/" className={`block rounded-[var(--radius-sm)] px-2 py-1 ${!source ? 'bg-[var(--color-raised)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-raised)]'}`}>
                All
              </Link>
            </li>
            {sources.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/?source=${s.id}`}
                  className={`block rounded-[var(--radius-sm)] px-2 py-1 ${source === s.id ? 'bg-[var(--color-raised)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-raised)]'}`}
                >
                  {s.display_name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Link
            href={favorite === '1' ? '/' : '/?favorite=1'}
            className={`block rounded-[var(--radius-sm)] px-2 py-1 text-sm ${favorite === '1' ? 'bg-[var(--color-raised)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-raised)]'}`}
          >
            ★ Favourites
          </Link>
        </div>
      </aside>

      {/* Grid */}
      <div className="flex-1">
        {!hasAnySource ? (
          <EmptyState />
        ) : refs.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">No references match. Try clearing filters, or run `stylesync sync` for more sources.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {refs.map((r) => (
              <RefCard key={r.id} ref={r} drp={drpByRef.get(r.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-10">
      <h2 className="text-lg font-medium">No sources synced yet</h2>
      <p className="max-w-md text-sm text-[var(--color-fg-muted)]">
        StyleSync ships with adapters for Lapa Ninja (landing pages), Figma Community (official API), and an
        ad-hoc URL adapter for anything else. Run a sync from the terminal to populate this library.
      </p>
      <code className="font-mono-token rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-3 py-2 text-xs">
        stylesync sync
      </code>
    </div>
  );
}
