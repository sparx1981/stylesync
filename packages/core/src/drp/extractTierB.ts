import type { RawCapture } from '../adapters/types.js';
import type { DRP, ComponentRecipe, ComponentRole, TypeStep } from './types.js';
import { clusterColors, generateRamp, formatHex, parseToOklch } from './oklch.js';
import { contrastRatio } from '../util/contrast.js';

const MODULAR_RATIOS = [1.125, 1.2, 1.25, 1.333, 1.5];

export function extractTierB(capture: RawCapture, refId: string, sourceId: string): DRP {
  const samples = capture.computedStyles ?? [];

  const colorSamples = collectColorSamples(samples);
  const clusters = clusterColors(colorSamples, 4, 8);

  const { neutral, primary, accent, success, warning, danger } = assignRoles(clusters);

  const palette: DRP['color']['palette'] = {
    neutral: { base: formatHex(neutral.centroid), ramp: generateRamp(neutral.centroid) },
    primary: { base: formatHex(primary.centroid), ramp: generateRamp(primary.centroid) },
  };
  if (accent) palette.accent = { base: formatHex(accent.centroid), ramp: generateRamp(accent.centroid) };
  if (success) palette.success = { base: formatHex(success.centroid), ramp: generateRamp(success.centroid) };
  if (warning) palette.warning = { base: formatHex(warning.centroid), ramp: generateRamp(warning.centroid) };
  if (danger) palette.danger = { base: formatHex(danger.centroid), ramp: generateRamp(danger.centroid) };

  const isDark = neutral.centroid.l < 0.5;
  const themeMode: 'light' | 'dark' = isDark ? 'dark' : 'light';

  const semantic: Record<string, string> = isDark
    ? {
        'bg.canvas': palette.neutral.ramp['950'],
        'bg.surface': palette.neutral.ramp['900'],
        'bg.raised': palette.neutral.ramp['800'],
        'fg.default': palette.neutral.ramp['50'],
        'fg.muted': palette.neutral.ramp['400'],
        'fg.onPrimary': '#FFFFFF',
        'border.default': palette.neutral.ramp['800'],
        'border.focus': palette.primary.ramp['400'],
      }
    : {
        'bg.canvas': palette.neutral.ramp['50'],
        'bg.surface': '#FFFFFF',
        'bg.raised': palette.neutral.ramp['100'],
        'fg.default': palette.neutral.ramp['950'],
        'fg.muted': palette.neutral.ramp['600'],
        'fg.onPrimary': '#FFFFFF',
        'border.default': palette.neutral.ramp['200'],
        'border.focus': palette.primary.ramp['500'],
      };

  const minBodyRatio = contrastRatio(semantic['fg.default'], semantic['bg.canvas']);
  const wcagPass = minBodyRatio >= 4.5;

  const typography = extractTypeScale(samples);
  const space = extractSpacing(samples);
  const shape = extractShape(samples);
  const elevation = extractElevation(samples);
  const motion = extractMotion(samples);
  const layout = inferLayout(samples);
  const components = buildComponentRecipes(elevation);

  const clusterConfidence = clusters.length > 0 ? Math.min(1, clusters.length / 6) : 0.3;
  const coverage = Math.min(1, samples.length / 200);
  const confidence = Math.max(0.45, Math.min(0.95, 0.4 * clusterConfidence + 0.35 * coverage + 0.25 * (wcagPass ? 1 : 0.6)));

  const antiPatterns = buildAntiPatterns({ elevation, shape, paletteRoleCount: Object.keys(palette).length });

  const drp: DRP = {
    drp_version: 1,
    ref_id: refId,
    provenance: {
      source: sourceId,
      origin_url: capture.originUrl,
      creator_credit: capture.creatorCredit ?? 'Unknown',
      captured_at: capture.capturedAt,
      extraction_method: 'computed_css',
      confidence,
    },
    identity: {
      name: capture.title ?? refId,
      descriptors: buildDescriptors(themeMode, space, elevation),
      theme_mode: themeMode,
      density: space.unit_px <= 4 ? 'compact' : space.unit_px >= 8 ? 'spacious' : 'comfortable',
      character: buildCharacterSentence(themeMode, elevation, palette),
    },
    color: {
      palette,
      semantic,
      contrast_report: { min_body_ratio: round2(minBodyRatio), wcag_aa_pass: wcagPass, contrast_adjusted: false },
    },
    typography,
    space,
    shape,
    elevation,
    motion,
    layout,
    components,
    anti_patterns: antiPatterns,
    assets_policy: { may_emit_fonts: true, may_emit_images: false, may_emit_icons: false },
  };

  return drp;
}

function collectColorSamples(samples: RawCapture['computedStyles']) {
  const out: { color: string; weight: number }[] = [];
  for (const s of samples ?? []) {
    const area = Math.max(1, (s as { area?: number }).area ?? 1);
    for (const prop of ['color', 'background-color', 'border-color']) {
      const val = s.styles[prop];
      if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
        out.push({ color: val, weight: area });
      }
    }
  }
  return out;
}

function assignRoles(clusters: ReturnType<typeof clusterColors>) {
  if (clusters.length === 0) {
    const fallbackNeutral = { centroid: parseToOklch('#111111')!, weight: 1, members: [] };
    const fallbackPrimary = { centroid: parseToOklch('#6366F1')!, weight: 1, members: [] };
    return { neutral: fallbackNeutral, primary: fallbackPrimary, accent: undefined, success: undefined, warning: undefined, danger: undefined };
  }

  const byChromaAsc = [...clusters].sort((a, b) => (a.centroid.c ?? 0) - (b.centroid.c ?? 0));
  const lowChromaCandidates = byChromaAsc.slice(0, Math.max(1, Math.ceil(clusters.length / 2)));
  const neutral = [...lowChromaCandidates].sort((a, b) => b.weight - a.weight)[0];

  const remaining = clusters.filter((c) => c !== neutral);
  const byChromaDesc = [...remaining].sort((a, b) => (b.centroid.c ?? 0) - (a.centroid.c ?? 0));
  const primary = byChromaDesc[0] ?? neutral;

  const rest = remaining.filter((c) => c !== primary);
  const success = rest.find((c) => inHueRange(c.centroid.h, 110, 175));
  const warning = rest.find((c) => inHueRange(c.centroid.h, 55, 95));
  const danger = rest.find((c) => inHueRange(c.centroid.h, 5, 40) || inHueRange(c.centroid.h, 340, 360));
  const accent = rest.find((c) => c !== success && c !== warning && c !== danger);

  return { neutral, primary, accent, success, warning, danger };
}

function inHueRange(h: number | undefined, min: number, max: number): boolean {
  if (h === undefined) return false;
  return h >= min && h <= max;
}

function extractTypeScale(samples: RawCapture['computedStyles']) {
  const sizes = new Map<number, number>();
  for (const s of samples ?? []) {
    const raw = s.styles['font-size'];
    const px = parseFloat(raw);
    if (!px || Number.isNaN(px)) continue;
    sizes.set(px, (sizes.get(px) ?? 0) + 1);
  }

  const sorted = [...sizes.entries()].sort((a, b) => a[0] - b[0]);
  const basePx = sorted.length ? closestTo(16, sorted.map(([px]) => px)) : 16;

  let bestRatio = 1.25;
  if (sorted.length >= 2) {
    let bestScore = -Infinity;
    for (const ratio of MODULAR_RATIOS) {
      let score = 0;
      for (const [px] of sorted) {
        const stepsFromBase = Math.round(Math.log(px / basePx) / Math.log(ratio));
        const predicted = basePx * ratio ** stepsFromBase;
        score -= Math.abs(predicted - px);
      }
      if (score > bestScore) {
        bestScore = score;
        bestRatio = ratio;
      }
    }
  }

  const stepNames = ['xs', 'sm', 'base', 'lg', 'xl', '2xl'];
  const offsets = [-2, -1, 0, 1, 2, 3];
  const steps: Record<string, TypeStep> = {};
  for (let i = 0; i < stepNames.length; i++) {
    const sizePx = basePx * bestRatio ** offsets[i];
    const measured = findNearestLineHeight(samples, sizePx);
    steps[stepNames[i]] = {
      size: pxToRem(sizePx),
      line: measured ?? (offsets[i] <= 0 ? 1.5 : 1.25),
      tracking: offsets[i] > 1 ? '-0.02em' : offsets[i] === 0 ? '0' : '0.01em',
      weight: offsets[i] >= 2 ? 700 : offsets[i] >= 1 ? 600 : offsets[i] === 0 ? 500 : 400,
    };
  }

  // Real computed CSS often uses a different font-family for headings than
  // for body copy (a distinct display face is one of the most common brand
  // signals) -- sampling h1-h4 and p/span/li/a separately, rather than
  // collapsing everything into one "most common font-family" value, is the
  // difference between actually capturing that distinction and silently
  // flattening it to a single guess.
  const overallFamily = mostCommon((samples ?? []).map((s) => s.styles['font-family']).filter(Boolean)) ?? 'system-ui, sans-serif';
  const displayFamily = familyForTags(samples, ['h1', 'h2', 'h3', 'h4']) ?? overallFamily;
  const bodyFamily = familyForTags(samples, ['p', 'span', 'li', 'a']) ?? overallFamily;

  return {
    families: {
      display: { stack: displayFamily, source: 'system' as const, weights: [600, 700] },
      body: { stack: bodyFamily, source: 'system' as const, weights: [400, 500] },
      mono: { stack: 'ui-monospace, SFMono-Regular, monospace', source: 'system' as const, weights: [400] },
    },
    scale: { ratio: bestRatio, base_px: Math.round(basePx), steps },
  };
}

// Samples are labelled either "tag.class1.class2" (the generic per-element
// dedup pass in captureRoutine's extractStyles) or "tag#index" (the
// SELECTOR_HEURISTICS pass, e.g. "h1#0") -- matching on either form covers
// both sources of samples for a given tag name.
function familyForTags(samples: RawCapture['computedStyles'], tags: string[]): string | undefined {
  const values = (samples ?? [])
    .filter((s) => tags.some((t) => s.selector === t || s.selector.startsWith(`${t}.`) || s.selector.startsWith(`${t}#`)))
    .map((s) => s.styles['font-family'])
    .filter(Boolean);
  return mostCommon(values);
}

function findNearestLineHeight(samples: RawCapture['computedStyles'], targetPx: number): number | undefined {
  let best: { diff: number; line: number } | undefined;
  for (const s of samples ?? []) {
    const fs = parseFloat(s.styles['font-size']);
    const lh = parseFloat(s.styles['line-height']);
    if (!fs || !lh || Number.isNaN(fs) || Number.isNaN(lh)) continue;
    const ratio = lh / fs;
    if (ratio < 1 || ratio > 2.2) continue;
    const diff = Math.abs(fs - targetPx);
    if (!best || diff < best.diff) best = { diff, line: round2(ratio) };
  }
  return best?.line;
}

function extractSpacing(samples: RawCapture['computedStyles']) {
  const values = new Set<number>();
  for (const s of samples ?? []) {
    for (const prop of ['padding', 'margin', 'gap']) {
      for (const px of parsePxList(s.styles[prop])) {
        if (px > 0 && px < 200) values.add(Math.round(px));
      }
    }
  }
  const list = [...values];
  const unit = list.length ? gcdWithTolerance(list, 1) : 4;
  const scaleSteps = [0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64];
  return { unit_px: unit, scale: scaleSteps, section_rhythm_px: unit * 24 };
}

function parsePxList(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((v) => parseFloat(v))
    .filter((n) => !Number.isNaN(n));
}

function gcdWithTolerance(values: number[], tolerancePx: number): number {
  const candidates = [1, 2, 4, 8];
  let best = 4;
  let bestScore = -Infinity;
  for (const unit of candidates) {
    let score = 0;
    for (const v of values) {
      const remainder = v % unit;
      const distance = Math.min(remainder, unit - remainder);
      score -= distance > tolerancePx ? distance : 0;
    }
    if (score > bestScore) {
      bestScore = score;
      best = unit;
    }
  }
  return best;
}

function extractShape(samples: RawCapture['computedStyles']) {
  const radii = (samples ?? []).map((s) => parseFloat(s.styles['border-radius'])).filter((n) => !Number.isNaN(n) && n >= 0);
  const modeRadius = mostCommonNumber(radii) ?? 8;
  return {
    radius: {
      none: '0',
      sm: `${Math.max(2, Math.round(modeRadius * 0.5))}px`,
      md: `${Math.round(modeRadius)}px`,
      lg: `${Math.round(modeRadius * 1.6)}px`,
      pill: '9999px',
    },
    border_widths: { hairline: '1px', emphasis: '2px' },
  };
}

function extractElevation(samples: RawCapture['computedStyles']) {
  const shadows = (samples ?? []).map((s) => s.styles['box-shadow']).filter((v) => v && v !== 'none');
  const shadowRatio = shadows.length / Math.max(1, (samples ?? []).length);
  const strategy: DRP['elevation']['strategy'] = shadowRatio > 0.08 ? 'shadow' : shadowRatio > 0.02 ? 'mixed' : 'border';
  return {
    strategy,
    levels: {
      '0': 'none',
      '1': '0 1px 2px rgb(0 0 0 / .24)',
      '2': '0 4px 12px rgb(0 0 0 / .28)',
      '3': '0 12px 32px rgb(0 0 0 / .36)',
    },
  };
}

function extractMotion(samples: RawCapture['computedStyles']) {
  const durations = (samples ?? [])
    .map((s) => parseFloat(s.styles['transition-duration']) * 1000)
    .filter((n) => !Number.isNaN(n) && n > 0);
  const fast = durations.length ? Math.min(...durations) : 120;
  const base = durations.length ? mostCommonNumber(durations) ?? 200 : 200;
  const slow = durations.length ? Math.max(...durations) : 360;

  return {
    durations: { fast: Math.round(fast), base: Math.round(base), slow: Math.round(slow) },
    easings: {
      standard: 'cubic-bezier(.2,0,0,1)',
      entrance: 'cubic-bezier(0,0,0,1)',
      exit: 'cubic-bezier(.3,0,1,1)',
    },
    signatures: [
      { trigger: 'hover', target: 'button', effect: 'bg shift', duration: Math.round(fast) },
      { trigger: 'mount', target: 'card', effect: 'fade + translateY(8px)', duration: Math.round(base), stagger: 40 },
    ],
    reduced_motion_fallback: 'opacity-only',
  };
}

function inferLayout(samples: RawCapture['computedStyles']): DRP['layout'] {
  const hasSidebar = (samples ?? []).some((s) => s.selector.includes('nav') && (s.styles['padding'] ?? '').length > 0);
  return {
    container_max_px: 1200,
    grid: { columns: 12, gutter_px: 24 },
    breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 },
    nav_pattern: hasSidebar ? 'sidebar' : 'topbar',
    content_alignment: 'left',
  };
}

function buildComponentRecipes(elevation: DRP['elevation']): Partial<Record<ComponentRole, ComponentRecipe>> {
  const elevationLevel = elevation.strategy === 'shadow' ? '1' : '0';
  return {
    'action.button.primary': {
      bg: 'primary.500', fg: 'fg.onPrimary', radius: 'md', padding: '10px 16px', font: 'sm/500', elevation: elevationLevel,
      states: { hover: { bg: 'primary.400' }, active: { bg: 'primary.600' }, disabled: { opacity: 0.5 }, focus: { ring: '2px border.focus' } },
    },
    'action.button.secondary': {
      bg: 'transparent', fg: 'fg.default', border: '1px solid border.default', radius: 'md', padding: '10px 16px',
      states: { hover: { bg: 'bg.raised' }, focus: { ring: '2px border.focus' } },
    },
    'input.text': {
      bg: 'bg.surface', fg: 'fg.default', border: '1px solid border.default', radius: 'sm', padding: '8px 12px',
      states: { focus: { ring: '2px border.focus', border: 'primary.400' }, disabled: { opacity: 0.5 } },
    },
    'display.card': { bg: 'bg.surface', border: elevation.strategy !== 'shadow' ? '1px solid border.default' : undefined, radius: 'lg', elevation: elevationLevel },
    'display.badge': { bg: 'bg.raised', fg: 'fg.muted', radius: 'pill', padding: '2px 8px', font: 'xs/500' },
  };
}

function buildDescriptors(themeMode: 'light' | 'dark', space: DRP['space'], elevation: DRP['elevation']): string[] {
  const d: string[] = [themeMode];
  d.push(elevation.strategy === 'shadow' ? 'soft-elevation' : 'flat-bordered');
  d.push(space.unit_px <= 4 ? 'compact' : 'spacious');
  return d;
}

function buildCharacterSentence(themeMode: string, elevation: DRP['elevation'], palette: DRP['color']['palette']): string {
  const surfaceSentence =
    elevation.strategy === 'shadow'
      ? 'Surfaces are separated with soft shadows.'
      : elevation.strategy === 'mixed'
        ? 'Surfaces mix hairline borders and occasional shadows.'
        : 'Flat surfaces separated by hairline borders rather than shadows.';
  const accentSentence = palette.accent ? 'Colour is used for both primary action and a secondary accent.' : 'Colour is reserved mainly for action and state.';
  return `${themeMode === 'dark' ? 'Dark theme.' : 'Light theme.'} ${surfaceSentence} ${accentSentence}`;
}

function buildAntiPatterns(opts: { elevation: DRP['elevation']; shape: DRP['shape']; paletteRoleCount: number }): string[] {
  const patterns: string[] = [];
  if (opts.elevation.strategy === 'border') {
    patterns.push('Do not add box-shadows to cards — this system separates surfaces with hairline borders.');
  }
  const radii = Object.values(opts.shape.radius).filter((r) => r !== '0' && r !== '9999px');
  if (new Set(radii).size === 1) {
    patterns.push(`Do not use rounded-full on buttons — this system uses ${radii[0]} radius throughout.`);
  }
  if (opts.paletteRoleCount <= 4) {
    patterns.push('Do not introduce a second accent colour on one screen.');
  }
  return patterns;
}

function closestTo(target: number, values: number[]): number {
  return values.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), values[0]);
}

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function mostCommonNumber(values: number[]): number | undefined {
  return mostCommon(values.map((v) => Math.round(v)));
}

function pxToRem(px: number): string {
  return `${round2(px / 16)}rem`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
