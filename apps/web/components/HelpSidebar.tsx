'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  { href: '/help', label: 'Overview' },
  { href: '/help/getting-started', label: 'Getting started' },
  { href: '/help/sources', label: 'Sources & syncing' },
  { href: '/help/reference-detail', label: 'Working with a reference' },
  { href: '/help/applying-styles', label: 'Applying styles to your project' },
  { href: '/help/cli-reference', label: 'CLI reference' },
  { href: '/help/faq', label: 'FAQ & troubleshooting' },
];

export function HelpSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 text-sm">
      {SECTIONS.map((s) => {
        const active = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`rounded-[var(--radius-sm)] px-3 py-1.5 ${
              active
                ? 'bg-[var(--color-raised)] text-[var(--color-fg)]'
                : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-raised)] hover:text-[var(--color-fg)]'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
