'use client';

import { useEffect, useState } from 'react';
import type { DRP } from '@stylesync/core';

// Extracts a loadable Google Fonts family name from a CSS font-stack string
// like `"Poppins", sans-serif` or `Inter, -apple-system, ...` -- takes the
// first entry, strips quotes. Returns null for generic/system stacks with no
// real family name up front (nothing useful to ask Google Fonts for).
function primaryFamilyName(stack: string): string | null {
  const first = stack.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
  if (!first) return null;
  const generic = ['sans-serif', 'serif', 'monospace', 'system-ui', 'ui-monospace', 'ui-sans-serif', 'ui-serif', 'cursive', 'fantasy'];
  if (generic.includes(first.toLowerCase())) return null;
  return first;
}

// One row in the Fonts section: label, a live rendered preview (loading the
// real family from Google Fonts when we can, since a name/description alone
// doesn't tell you what a typeface actually looks like), and the raw stack.
function FontRow({ role, stack, source }: { role: string; stack: string; source: 'google' | 'system' | 'custom' }) {
  const [loaded, setLoaded] = useState(false);
  const familyName = source === 'google' ? primaryFamilyName(stack) : null;

  useEffect(() => {
    if (!familyName) return;
    const id = `gfont-${familyName.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) {
      setLoaded(true);
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familyName)}:wght@400;600;700&display=swap`;
    link.onload = () => setLoaded(true);
    link.onerror = () => setLoaded(false);
    document.head.appendChild(link);
  }, [familyName]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="font-mono-token w-16 text-xs capitalize text-[var(--color-fg-subtle)]">{role}</span>
        <span className="text-sm">{stack}</span>
        <span className="font-mono-token text-xs text-[var(--color-fg-subtle)]">({source})</span>
      </div>
      <p
        className="truncate text-2xl"
        style={{ fontFamily: familyName && loaded ? `"${familyName}", ${stack}` : stack }}
      >
        The quick brown fox jumps
      </p>
    </div>
  );
}

export function DrpTabs({ drp }: { drp: DRP }) {
  const [tab, setTab] = useState<'tokens' | 'components' | 'provenance'>('tokens');

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-[var(--color-border)]">
        {(['tokens', 'components', 'provenance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize ${
              tab === t ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'tokens' && <TokensPanel drp={drp} />}
      {tab === 'components' && <ComponentsPanel drp={drp} />}
      {tab === 'provenance' && <ProvenancePanel drp={drp} />}
    </div>
  );
}

function TokensPanel({ drp }: { drp: DRP }) {
  const navRecipe = drp.components['layout.sidebar'] ?? drp.components['layout.topbar'];
  const footerRecipe = drp.components['layout.page'];
  const primaryBtnNotes = (drp.components['action.button.primary'] as Record<string, unknown> | undefined)?.notes;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">Colour ramps</h3>
        <div className="flex flex-col gap-2">
          {Object.entries(drp.color.palette).map(([role, ramp]) =>
            ramp ? (
              <div key={role} className="flex items-center gap-3">
                <span className="font-mono-token w-16 text-xs text-[var(--color-fg-muted)]">{role}</span>
                <div className="flex flex-1 overflow-hidden rounded-[var(--radius-sm)]">
                  {Object.entries(ramp.ramp).map(([step, hex]) => (
                    <div key={step} className="group relative flex-1">
                      <div className="h-8" style={{ background: hex }} />
                      <span className="font-mono-token absolute inset-x-0 bottom-full hidden -translate-y-1 text-center text-[10px] text-[var(--color-fg-subtle)] group-hover:block">
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
        <p className="font-mono-token mt-2 text-xs text-[var(--color-fg-subtle)]">
          min body contrast {drp.color.contrast_report.min_body_ratio}:1 · WCAG AA {drp.color.contrast_report.wcag_aa_pass ? 'pass' : 'fail'}
          {drp.color.contrast_report.contrast_adjusted ? ' (auto-corrected)' : ''}
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">Fonts</h3>
        <div className="flex flex-col gap-4">
          <FontRow role="display" stack={drp.typography.families.display.stack} source={drp.typography.families.display.source} />
          <FontRow role="body" stack={drp.typography.families.body.stack} source={drp.typography.families.body.source} />
          {(drp.typography.families.additional ?? []).map((f) => (
            <FontRow key={f.role} role={f.role} stack={f.stack} source={f.source} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">Type scale</h3>
        <div className="flex flex-col gap-3">
          {Object.entries(drp.typography.scale.steps).map(([name, step]) => (
            <div key={name} className="flex items-baseline gap-4">
              <span className="font-mono-token w-10 text-xs text-[var(--color-fg-subtle)]">{name}</span>
              <span style={{ fontSize: step.size, lineHeight: step.line, fontWeight: step.weight, letterSpacing: step.tracking }}>
                The quick brown fox
              </span>
              <span className="font-mono-token ml-auto text-xs text-[var(--color-fg-subtle)]">{step.size}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">Spacing</h3>
        <div className="flex items-end gap-1">
          {drp.space.scale.map((px) => (
            <div key={px} className="flex flex-col items-center gap-1">
              <div style={{ width: Math.max(2, px), height: 16 }} className="bg-[var(--color-accent)]" />
              <span className="font-mono-token text-[10px] text-[var(--color-fg-subtle)]">{px}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">Radii &amp; elevation</h3>
        <div className="flex flex-wrap gap-4">
          {Object.entries(drp.shape.radius).map(([name, value]) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <div className="h-12 w-12 border border-[var(--color-border)] bg-[var(--color-raised)]" style={{ borderRadius: value }} />
              <span className="font-mono-token text-[10px] text-[var(--color-fg-subtle)]">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">Layout &amp; navigation</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[var(--color-fg-subtle)]">Nav pattern</dt>
          <dd className="capitalize">{drp.layout.nav_pattern}</dd>
          <dt className="text-[var(--color-fg-subtle)]">Content alignment</dt>
          <dd className="capitalize">{drp.layout.content_alignment}</dd>
          {navRecipe?.logo_placement != null && (
            <>
              <dt className="text-[var(--color-fg-subtle)]">Logo placement</dt>
              <dd>{String(navRecipe.logo_placement)}</dd>
            </>
          )}
          {navRecipe?.header_style != null && (
            <>
              <dt className="text-[var(--color-fg-subtle)]">Header style</dt>
              <dd>{String(navRecipe.header_style)}</dd>
            </>
          )}
          {footerRecipe?.footer_style != null && (
            <>
              <dt className="text-[var(--color-fg-subtle)]">Footer style</dt>
              <dd>{String(footerRecipe.footer_style)}</dd>
            </>
          )}
          {primaryBtnNotes != null && (
            <>
              <dt className="text-[var(--color-fg-subtle)]">Primary button</dt>
              <dd>{String(primaryBtnNotes)}</dd>
            </>
          )}
        </dl>
      </section>
    </div>
  );
}

/**
 * The "wow moment" (spec §11.2 / §13.3 S2): the reference's design system,
 * reconstituted as working components you can hover and focus — built
 * straight from drp.components using inline styles resolved against the
 * DRP's own semantic tokens, no framework theme config required.
 */
function ComponentsPanel({ drp }: { drp: DRP }) {
  const resolve = (ref: string | undefined): string | undefined => {
    if (!ref) return undefined;
    const match = /^([a-z]+)\.(\d+)$/i.exec(ref);
    if (match) {
      const [, role, step] = match;
      return (drp.color.palette as Record<string, { ramp: Record<string, string> } | undefined>)[role]?.ramp[step];
    }
    return drp.color.semantic[ref] ?? ref;
  };

  const primaryBtn = drp.components['action.button.primary'];
  const secondaryBtn = drp.components['action.button.secondary'];
  const input = drp.components['input.text'];
  const card = drp.components['display.card'];
  const badge = drp.components['display.badge'];

  return (
    <div className="flex flex-col gap-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-8" style={{ background: resolve('bg.canvas') }}>
      <div className="flex flex-wrap items-center gap-3">
        {primaryBtn && (
          <button
            style={{
              background: resolve(primaryBtn.bg as string),
              color: resolve(primaryBtn.fg as string),
              borderRadius: drp.shape.radius[(primaryBtn.radius as string) ?? 'md'],
              padding: primaryBtn.padding as string,
              boxShadow: primaryBtn.elevation ? drp.elevation.levels[primaryBtn.elevation as string] : undefined,
            }}
            className="text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2"
          >
            Primary action
          </button>
        )}
        {secondaryBtn && (
          <button
            style={{
              background: resolve(secondaryBtn.bg as string) ?? 'transparent',
              color: resolve(secondaryBtn.fg as string),
              border: `1px solid ${resolve('border.default')}`,
              borderRadius: drp.shape.radius[(secondaryBtn.radius as string) ?? 'md'],
              padding: secondaryBtn.padding as string,
            }}
            className="text-sm font-medium hover:opacity-90 focus-visible:outline focus-visible:outline-2"
          >
            Secondary
          </button>
        )}
        {badge && (
          <span
            style={{
              background: resolve(badge.bg as string),
              color: resolve(badge.fg as string),
              borderRadius: drp.shape.radius[(badge.radius as string) ?? 'pill'],
              padding: badge.padding as string,
            }}
            className="text-xs font-medium"
          >
            Badge
          </span>
        )}
      </div>

      {input && (
        <input
          placeholder="Input field"
          style={{
            background: resolve(input.bg as string),
            color: resolve(input.fg as string),
            border: `1px solid ${resolve('border.default')}`,
            borderRadius: drp.shape.radius[(input.radius as string) ?? 'sm'],
            padding: input.padding as string,
          }}
          className="max-w-xs text-sm focus-visible:outline focus-visible:outline-2"
        />
      )}

      {card && (
        <div
          style={{
            background: resolve(card.bg as string),
            border: card.border ? `1px solid ${resolve('border.default')}` : undefined,
            borderRadius: drp.shape.radius[(card.radius as string) ?? 'lg'],
            boxShadow: card.elevation ? drp.elevation.levels[card.elevation as string] : undefined,
            color: resolve('fg.default'),
          }}
          className="max-w-sm p-4 text-sm"
        >
          <p className="font-medium">Card title</p>
          <p style={{ color: resolve('fg.muted') }} className="mt-1 text-xs">
            Reconstituted from this reference&apos;s extracted recipe — hover the button above to see its state transition.
          </p>
        </div>
      )}

      {Object.keys(drp.components).length === 0 && (
        <p className="text-sm" style={{ color: resolve('fg.muted') }}>
          No component recipes extracted for this reference yet (low-confidence or vision-inferred capture).
        </p>
      )}
    </div>
  );
}

function ProvenancePanel({ drp }: { drp: DRP }) {
  return (
    <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-[var(--color-fg-subtle)]">Source</dt>
      <dd>{drp.provenance.source}</dd>
      <dt className="text-[var(--color-fg-subtle)]">Origin</dt>
      <dd className="truncate">
        <a href={drp.provenance.origin_url} className="text-[var(--color-accent)] hover:underline">
          {drp.provenance.origin_url}
        </a>
      </dd>
      <dt className="text-[var(--color-fg-subtle)]">Creator</dt>
      <dd>{drp.provenance.creator_credit}</dd>
      <dt className="text-[var(--color-fg-subtle)]">Method</dt>
      <dd className="font-mono-token">{drp.provenance.extraction_method}</dd>
      <dt className="text-[var(--color-fg-subtle)]">Confidence</dt>
      <dd className="font-mono-token">{drp.provenance.confidence.toFixed(2)}</dd>
      <dt className="text-[var(--color-fg-subtle)]">Captured</dt>
      <dd>{new Date(drp.provenance.captured_at).toLocaleString()}</dd>
    </dl>
  );
}
