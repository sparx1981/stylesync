import { HelpSidebar } from '../../components/HelpSidebar';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1200px] gap-10 px-6 py-8">
      <aside className="hidden w-56 shrink-0 flex-col gap-1 md:flex">
        <div className="sticky top-20">
          <h2 className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">Help</h2>
          <HelpSidebar />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
