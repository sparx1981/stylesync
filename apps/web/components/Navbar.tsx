import Link from 'next/link';

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-canvas)]/90 px-6 py-3 backdrop-blur">
      <Link href="/" className="font-mono-token text-3xl font-bold tracking-tight text-[var(--color-fg)]">
        stylesync<span className="text-[var(--color-accent)]">.</span>
      </Link>
      <nav className="flex items-center gap-1 text-sm">
        <Link href="/" className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-raised)] hover:text-[var(--color-fg)]">
          Library
        </Link>
        <Link href="/sources" className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-raised)] hover:text-[var(--color-fg)]">
          Sources
        </Link>
        <Link href="/help" className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-raised)] hover:text-[var(--color-fg)]">
          Help
        </Link>
      </nav>
    </header>
  );
}
