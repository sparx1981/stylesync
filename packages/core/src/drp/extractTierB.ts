import { differenceEuclidean } from 'culori';
import type { RawCapture } from '../adapters/types.js';
import type { DRP, ComponentRecipe, ComponentRole, DRPTypography, MotionSignature, TypeStep } from './types.js';
import { clusterColors, generateRamp, formatHex, parseToOklch } from './oklch.js';
import { contrastRatio } from '../util/contrast.js';

const MODULAR_RATIOS = [1.125, 1.2, 1.25, 1.333, 1.5];
const oklchDistance = differenceEuclidean('oklch');

// Everything the component/motion derivation helpers need in order to map a
// raw observed CSS value (a hex, an rgb(), a px number) back onto the
// token vocabulary the rest of the DRP already speaks (`primary.500`,
// `bg.surface`, `radius.md`, `elevation.1`...) instead of inventing new
// numbers. Assembled once real palette/shape/elevation/typography are known.
interface ComponentDeriveContext {
  palette: DRP['color']['palette'];
  semantic: Record<string, string>;
  shape: DRP['shape'];
  elevation: DRP['elevation'];
  typography: DRPTypography;
}

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
  // Component/motion derivation both need to translate a raw observed color
  // or shadow back into the token vocabulary (`primary.500`, `elevation.1`),
  // which requires the palette/semantic/shape/elevation/typography this
  // reference already resolved — hence building this context only now.
  const deriveCtx: ComponentDeriveContext = { palette, semantic, shape, elevation, typography };
  const motion = extractMotion(samples, capture.stylesheetText, deriveCtx);
  const layout = inferLayout(samples, capture.stylesheetText);
  const components = buildComponentRecipes(samples, deriveCtx);

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

  // Cluster the real, distinct box-shadow values that were actually observed
  // by intensity (blur + spread + vertical offset) rather than reporting one
  // fixed triad of shadow strings regardless of what the source site does.
  const uniqueShadows = [...new Set(shadows)]
    .map((value) => ({ value, intensity: shadowIntensity(value) }))
    .sort((a, b) => a.intensity - b.intensity);

  const levels: Record<string, string> = { '0': 'none' };
  if (uniqueShadows.length === 0) {
    // No real box-shadow was ever observed (a "border" strategy site, or a
    // capture with too few samples) -- these three are a documented, clearly
    // synthetic fallback, not a measurement.
    levels['1'] = '0 1px 2px rgb(0 0 0 / .24)';
    levels['2'] = '0 4px 12px rgb(0 0 0 / .28)';
    levels['3'] = '0 12px 32px rgb(0 0 0 / .36)';
  } else {
    const chosen = pickSpread(uniqueShadows, 3);
    levels['1'] = chosen[0]?.value ?? '0 1px 2px rgb(0 0 0 / .24)';
    levels['2'] = chosen[1]?.value ?? scaleShadow(levels['1'], 1.6);
    levels['3'] = chosen[2]?.value ?? scaleShadow(levels['2'], 1.6);
  }

  return { strategy, levels };
}

// box-shadow can be a comma-separated list ("0 1px 2px rgba(0,0,0,.2), 0 4px
// 8px rgba(0,0,0,.1)") where the commas *inside* rgba()/hsla() must not be
// treated as separators -- a naive `.split(',')` would slice a color value
// in half.
function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function shadowIntensity(value: string): number {
  let maxIntensity = 0;
  for (const shadow of splitTopLevelCommas(value)) {
    const nums = (shadow.match(/-?\d*\.?\d+px/g) ?? []).map((v) => parseFloat(v));
    if (nums.length >= 3) {
      const [, offsetY = 0, blur = 0, spread = 0] = nums;
      maxIntensity = Math.max(maxIntensity, blur + Math.abs(spread) * 1.5 + Math.abs(offsetY) * 0.5);
    } else if (nums.length) {
      maxIntensity = Math.max(maxIntensity, ...nums.map(Math.abs));
    }
  }
  return maxIntensity;
}

function scaleShadow(value: string, factor: number): string {
  return value.replace(/(-?\d*\.?\d+)px/g, (_, n) => `${Math.round(parseFloat(n) * factor)}px`);
}

function pickSpread<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const out: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (arr.length - 1)) / Math.max(1, n - 1));
    if (!seen.has(idx)) {
      seen.add(idx);
      out.push(arr[idx]);
    }
  }
  return out;
}

function extractMotion(samples: RawCapture['computedStyles'], stylesheetText: string | undefined, ctx: ComponentDeriveContext) {
  const durations = (samples ?? [])
    .map((s) => parseFloat(s.styles['transition-duration']) * 1000)
    .filter((n) => !Number.isNaN(n) && n > 0);
  const fast = durations.length ? Math.min(...durations) : 120;
  const base = durations.length ? mostCommonNumber(durations) ?? 200 : 200;
  const slow = durations.length ? Math.max(...durations) : 360;
  const durationsOut = { fast: Math.round(fast), base: Math.round(base), slow: Math.round(slow) };

  // 'ease' is the CSS initial value for transition-timing-function, so it
  // shows up on almost every element whether or not that element actually
  // has a declared transition -- excluding it unless it's the *only* value
  // observed keeps the "standard" easing from defaulting to noise.
  const rawTimingFns = (samples ?? []).map((s) => s.styles['transition-timing-function']).filter(Boolean) as string[];
  const meaningfulTimingFns = rawTimingFns.filter((v) => v !== 'ease');
  const timingPool = meaningfulTimingFns.length ? meaningfulTimingFns : rawTimingFns;
  const standard = mostCommon(timingPool) ?? 'cubic-bezier(.2,0,0,1)';

  const ranked = [...countBy(meaningfulTimingFns).entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  const entrance = ranked[1] ?? deriveEasingVariant(standard, 'entrance');
  const exit = ranked[2] ?? deriveEasingVariant(standard, 'exit');

  return {
    durations: durationsOut,
    easings: { standard, entrance, exit },
    signatures: buildMotionSignatures(samples, stylesheetText, durationsOut, ctx),
    reduced_motion_fallback: 'opacity-only',
  };
}

// Nudges a real observed cubic-bezier's control points to produce a distinct
// entrance/exit variant when the capture only ever saw one timing function
// in the wild -- a documented derivation from real data, rather than the
// three previously-fixed bezier strings used regardless of source.
function deriveEasingVariant(standard: string, kind: 'entrance' | 'exit'): string {
  const m = standard.match(/cubic-bezier\(\s*([^)]+)\)/);
  if (!m) return kind === 'entrance' ? 'cubic-bezier(0,0,0,1)' : 'cubic-bezier(.3,0,1,1)';
  const parts = m[1].split(',').map((n) => parseFloat(n.trim()));
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return kind === 'entrance' ? 'cubic-bezier(0,0,0,1)' : 'cubic-bezier(.3,0,1,1)';
  }
  const [x1, y1, x2, y2] = parts;
  if (kind === 'entrance') return `cubic-bezier(${round2(x1)},${round2(y1)},${round2(x2 * 0.5)},1)`;
  return `cubic-bezier(${round2(x1 * 0.5)},0,${round2(x2)},${round2(y2)})`;
}

function buildMotionSignatures(
  samples: RawCapture['computedStyles'],
  stylesheetText: string | undefined,
  durations: { fast: number; base: number; slow: number },
  ctx: ComponentDeriveContext
): MotionSignature[] {
  const out: MotionSignature[] = [];

  const hoverDelta = findStateDelta(samples, '::state:hover', /button|\bbtn\b/i, ctx);
  if (hoverDelta) {
    out.push({ trigger: 'hover', target: 'button', effect: describeDelta(hoverDelta), duration: durations.fast });
  }
  const focusDelta = findStateDelta(samples, '::state:focus', /input|textarea|select/i, ctx);
  if (focusDelta) {
    out.push({ trigger: 'focus', target: 'input', effect: describeDelta(focusDelta), duration: durations.fast });
  }

  if (stylesheetText) {
    for (const scanned of scanHoverRulesForTransform(stylesheetText).slice(0, 3)) {
      out.push({ trigger: 'hover', target: classifyTarget(scanned.selectorHint), effect: scanned.effect, duration: durations.base });
    }
  }

  if (out.length === 0) {
    // Nothing real was observed at all -- no button/input to hover/focus,
    // and no `:hover` rule touching transform/box-shadow anywhere in the
    // captured stylesheet text. These two are a clearly-labelled guess
    // rather than a measurement of this specific source.
    out.push({ trigger: 'hover', target: 'button', effect: 'bg shift', duration: durations.fast });
    out.push({ trigger: 'mount', target: 'card', effect: 'fade + translateY(8px)', duration: durations.base, stagger: 40 });
  }

  const seen = new Set<string>();
  const deduped: MotionSignature[] = [];
  for (const sig of out) {
    const key = `${sig.trigger}|${sig.target}|${sig.effect}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(sig);
  }
  return deduped.slice(0, 6);
}

// Best-effort scan of the captured stylesheet text for `:hover` rules that
// touch `transform` or `box-shadow` -- a crude regex pass (not a real CSS
// parser, so nested at-rules or multi-line rules can confuse it), but it's
// grounded in CSS the source actually shipped rather than invented.
function scanHoverRulesForTransform(stylesheetText: string): Array<{ selectorHint: string; effect: string }> {
  const results: Array<{ selectorHint: string; effect: string }> = [];
  const ruleRe = /([^{}]+):hover\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = ruleRe.exec(stylesheetText)) && guard < 500 && results.length < 10) {
    guard++;
    const selectorHint = m[1].trim().split(',').pop()?.trim().replace(/:hover$/, '') ?? '';
    const body = m[2];
    const transformVal = body.match(/transform\s*:\s*([^;]+)/)?.[1];
    if (transformVal) {
      const effect = /translateY\(\s*-/.test(transformVal)
        ? 'lifts on hover (translateY)'
        : /scale\(/.test(transformVal)
          ? 'scales on hover'
          : 'transforms on hover';
      results.push({ selectorHint, effect });
    } else if (/box-shadow\s*:/.test(body)) {
      results.push({ selectorHint, effect: 'shadow deepens on hover' });
    }
  }
  return results;
}

function classifyTarget(selectorHint: string): string {
  if (/card/i.test(selectorHint)) return 'card';
  if (/btn|button/i.test(selectorHint)) return 'button';
  if (/nav|menu/i.test(selectorHint)) return 'nav';
  return 'element';
}

function describeDelta(delta: Record<string, unknown>): string {
  return Object.entries(delta)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

function inferLayout(samples: RawCapture['computedStyles'], stylesheetText: string | undefined): DRP['layout'] {
  // Real `@media (min-width: Npx)` / `(max-width: Npx)` breakpoints, parsed
  // straight out of the captured stylesheet text, rather than the Tailwind
  // default scale reported unconditionally.
  const bpMatches = stylesheetText
    ? [...stylesheetText.matchAll(/\(\s*(?:min|max)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/gi)].map((m) => Math.round(parseFloat(m[1])))
    : [];
  const distinctBp = [...new Set(bpMatches)].filter((v) => v >= 320 && v <= 2000).sort((a, b) => a - b);

  let breakpoints: Record<string, number>;
  if (distinctBp.length >= 2) {
    const names = ['sm', 'md', 'lg', 'xl'];
    breakpoints = {};
    for (const [i, v] of pickSpread(distinctBp, Math.min(4, distinctBp.length)).entries()) {
      breakpoints[names[i]] = v;
    }
  } else {
    // Fewer than two distinct real breakpoints turned up in the captured
    // CSS -- not enough signal to trust, so this reports the Tailwind
    // standard scale as a labelled fallback rather than a near-empty guess.
    breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 };
  }

  // Container width: real elements whose class name reads like a page-level
  // content wrapper, wide enough to plausibly be one (not a small widget),
  // using their actual rendered width rather than a fixed 1200px constant.
  const containerCandidates = (samples ?? []).filter(
    (s) => /container|wrapper|content|main|inner/i.test(s.selector) && (s.width ?? 0) > 480 && (s.width ?? 0) < 2400
  );
  const widths = containerCandidates.map((s) => Math.round(s.width!));
  const container_max_px = widths.length ? mostCommonNumber(widths) ?? closestTo(1200, widths) : 1200;

  const hasSidebar = (samples ?? []).some((s) => s.selector.includes('nav') && (s.styles['padding'] ?? '').length > 0);

  // A centered container has equal (and non-zero) resolved left/right
  // margin -- getComputedStyle always resolves `margin: 0 auto` to real px
  // values, so this is a genuine measurement rather than a guess.
  const centeredCount = containerCandidates.filter((s) => isCenteredMargin(s.styles['margin'])).length;
  const content_alignment: 'left' | 'center' =
    containerCandidates.length > 0 && centeredCount / containerCandidates.length > 0.5 ? 'center' : 'left';

  return {
    container_max_px,
    grid: { columns: 12, gutter_px: 24 },
    breakpoints,
    nav_pattern: hasSidebar ? 'sidebar' : 'topbar',
    content_alignment,
  };
}

function isCenteredMargin(value: string | undefined): boolean {
  const parts = parsePxList(value);
  if (parts.length === 4) return parts[1] === parts[3] && parts[1] > 4;
  if (parts.length === 2) return parts[1] > 4;
  return false;
}

// Button/card/input selectors come from captureRoutine's two sampling
// passes: the SELECTOR_HEURISTICS pass labels rows like `button#0` or
// `[class*="card"]#1`, and the generic per-element dedup pass labels rows
// `tag.class1.class2`. Both forms need to be recognised to actually find
// "the real buttons on this page" rather than falling straight through to
// the generic-template fallback every time.
const BUTTON_HEURISTIC_PREFIXES = ['button#', '[role="button"]#', 'a.btn#', 'a[class*="button"]#', 'a[class*="btn"]#'];
const INPUT_HEURISTIC_PREFIXES = ['input#', 'textarea#', 'select#'];
const CARD_HEURISTIC_PREFIXES = ['[class*="card"]#', '[class*="Card"]#'];
const RAMP_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

function isButtonSample(selector: string): boolean {
  if (selector.includes('::state:')) return false;
  if (BUTTON_HEURISTIC_PREFIXES.some((p) => selector.startsWith(p))) return true;
  const tag = selector.split('.')[0];
  if (tag === 'button') return true;
  return tag === 'a' && /\.(btn|button)(\.|$)/i.test(selector);
}

function isInputSample(selector: string): boolean {
  if (selector.includes('::state:')) return false;
  if (INPUT_HEURISTIC_PREFIXES.some((p) => selector.startsWith(p))) return true;
  const tag = selector.split('.')[0];
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function isCardSample(selector: string): boolean {
  if (selector.includes('::state:')) return false;
  if (CARD_HEURISTIC_PREFIXES.some((p) => selector.startsWith(p))) return true;
  return /\.card\b/i.test(selector);
}

function isOpaqueColor(value: string | undefined): boolean {
  return !!value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)';
}

function nearestColorPath(cssColor: string | undefined, ctx: Pick<ComponentDeriveContext, 'palette' | 'semantic'>): string | undefined {
  if (!isOpaqueColor(cssColor)) return undefined;
  const target = parseToOklch(cssColor!);
  if (!target) return undefined;

  let best: { path: string; distance: number } | undefined;
  // Semantic tokens are checked first since they're the vocabulary the rest
  // of a hand-authored recipe already uses (fg.onPrimary, bg.raised,
  // border.default) -- a semantic match reads better than a raw ramp step
  // when the two are equally close.
  for (const [key, hex] of Object.entries(ctx.semantic)) {
    const candidate = parseToOklch(hex);
    if (!candidate) continue;
    const distance = oklchDistance(target, candidate);
    if (!best || distance < best.distance - 0.01) best = { path: key, distance };
  }
  for (const [role, ramp] of Object.entries(ctx.palette)) {
    if (!ramp) continue;
    for (const [step, hex] of Object.entries(ramp.ramp)) {
      const candidate = parseToOklch(hex);
      if (!candidate) continue;
      const distance = oklchDistance(target, candidate);
      if (!best || distance < best.distance) best = { path: `${role}.${step}`, distance };
    }
  }
  return best?.path;
}

function nearestRadiusKey(value: string | undefined, radius: Record<string, string>): string | undefined {
  const px = parseFloat(value ?? '');
  if (Number.isNaN(px)) return undefined;
  let best: { key: string; diff: number } | undefined;
  for (const [key, v] of Object.entries(radius)) {
    const tokenPx = key === 'pill' ? 9999 : parseFloat(v);
    if (Number.isNaN(tokenPx)) continue;
    const diff = Math.abs(tokenPx - px);
    if (!best || diff < best.diff) best = { key, diff };
  }
  return best?.key;
}

function nearestElevationLevel(shadowValue: string | undefined, levels: Record<string, string>): string {
  if (!shadowValue || shadowValue === 'none') return '0';
  const targetIntensity = shadowIntensity(shadowValue);
  let best = '0';
  let bestDiff = Infinity;
  for (const [key, v] of Object.entries(levels)) {
    if (v === 'none') continue;
    const diff = Math.abs(shadowIntensity(v) - targetIntensity);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = key;
    }
  }
  return best;
}

function nearestFontStep(fontSizePx: number, steps: Record<string, TypeStep>): string | undefined {
  let best: { name: string; diff: number } | undefined;
  for (const [name, step] of Object.entries(steps)) {
    const px = parseFloat(step.size) * 16;
    if (Number.isNaN(px)) continue;
    const diff = Math.abs(px - fontSizePx);
    if (!best || diff < best.diff) best = { name, diff };
  }
  return best?.name;
}

function fallbackElevationLevel(elevation: DRP['elevation']): string {
  return elevation.strategy === 'shadow' ? '1' : '0';
}

function shiftRampStep(tokenPath: string | undefined, direction: 1 | -1): string | undefined {
  if (!tokenPath || !tokenPath.includes('.')) return undefined;
  const [role, step] = tokenPath.split('.');
  const idx = RAMP_STEPS.indexOf(step);
  if (idx === -1) return undefined;
  // "hover" on a filled button conventionally reads as one step darker;
  // direction is a step index nudge, not a literal ramp-value delta.
  const newIdx = Math.max(0, Math.min(RAMP_STEPS.length - 1, idx + direction));
  return `${role}.${RAMP_STEPS[newIdx]}`;
}

/**
 * Compares a base sample against its `::state:hover`/`::state:focus`
 * counterpart (real deltas captured by captureRoutine's
 * `sampleInteractionStates`) and expresses whatever actually changed in the
 * DRP's own token vocabulary. Returns undefined when no matching pair of
 * samples exists, or when nothing meaningfully changed between them.
 */
function findStateDelta(
  samples: RawCapture['computedStyles'],
  suffix: '::state:hover' | '::state:focus',
  tagPattern: RegExp,
  ctx: Pick<ComponentDeriveContext, 'palette' | 'semantic' | 'elevation'>,
  allowedBaseSelectors?: Set<string>
): Record<string, unknown> | undefined {
  const stateSample = (samples ?? []).find((s) => s.selector.endsWith(suffix) && tagPattern.test(s.selector));
  if (!stateSample) return undefined;
  const baseSelector = stateSample.selector.slice(0, -suffix.length);
  // Only one element gets hovered/focused per capture (the *first* real
  // button/input on the page), so its delta is real but may not belong to
  // whichever variant (primary vs. secondary, say) is currently being
  // built. When a pool of allowed base selectors is given, the delta is
  // only applied to the variant it was actually observed on.
  if (allowedBaseSelectors && !allowedBaseSelectors.has(baseSelector)) return undefined;
  const baseSample = (samples ?? []).find((s) => s.selector === baseSelector);
  if (!baseSample) return undefined;

  const delta: Record<string, unknown> = {};

  const bg0 = baseSample.styles['background-color'];
  const bg1 = stateSample.styles['background-color'];
  if (bg1 && bg0 !== bg1) {
    const token = nearestColorPath(bg1, ctx);
    if (token) delta.bg = token;
  }

  const shadow0 = baseSample.styles['box-shadow'];
  const shadow1 = stateSample.styles['box-shadow'];
  if (shadow1 && shadow1 !== 'none' && shadow1 !== shadow0) {
    delta.elevation = nearestElevationLevel(shadow1, ctx.elevation.levels);
  }

  const transform1 = stateSample.styles['transform'];
  if (transform1 && transform1 !== 'none' && transform1 !== baseSample.styles['transform']) {
    delta.transform = transform1;
  }

  if (suffix === '::state:focus') {
    const outline1 = stateSample.styles['outline-color'];
    if (outline1 && outline1 !== baseSample.styles['outline-color'] && isOpaqueColor(outline1)) {
      delta.ring = `2px ${nearestColorPath(outline1, ctx) ?? 'border.focus'}`;
    }
  }

  return Object.keys(delta).length ? delta : undefined;
}

function buildComponentRecipes(
  samples: RawCapture['computedStyles'],
  ctx: ComponentDeriveContext
): Partial<Record<ComponentRole, ComponentRecipe>> {
  const all = samples ?? [];
  const buttonSamples = all.filter((s) => isButtonSample(s.selector));
  const inputSamples = all.filter((s) => isInputSample(s.selector));
  const cardSamples = all.filter((s) => isCardSample(s.selector));

  return {
    'action.button.primary': buildButtonRecipe(buttonSamples, all, ctx, 'primary'),
    'action.button.secondary': buildButtonRecipe(buttonSamples, all, ctx, 'secondary'),
    'input.text': buildInputRecipe(inputSamples, all, ctx),
    'display.card': buildCardRecipe(cardSamples, ctx),
    // No reliable heuristic samples a "badge" specifically (it isn't one of
    // captureRoutine's SELECTOR_HEURISTICS) -- kept as the original
    // documented generic default rather than guessed from unrelated samples.
    'display.badge': { bg: 'bg.raised', fg: 'fg.muted', radius: 'pill', padding: '2px 8px', font: 'xs/500' },
  };
}

function buildButtonRecipe(
  buttonSamples: RawCapture['computedStyles'],
  allSamples: RawCapture['computedStyles'],
  ctx: ComponentDeriveContext,
  variant: 'primary' | 'secondary'
): ComponentRecipe {
  const samples = buttonSamples ?? [];
  // A page's buttons usually split into "filled" (real background colour)
  // and "outline/ghost" (transparent or near-canvas background) -- matching
  // whichever group corresponds to the recipe slot being built means the
  // primary and secondary recipes actually describe two different buttons
  // instead of both describing the same average one.
  const filled = samples.filter((s) => isOpaqueColor(s.styles['background-color']));
  const outline = samples.filter((s) => !isOpaqueColor(s.styles['background-color']));
  const pool = variant === 'primary' ? (filled.length ? filled : samples) : outline.length ? outline : samples;

  if (pool.length === 0) {
    // No real button-like element was ever sampled on this page at all --
    // the original generic scaffold, kept as an explicit fallback rather
    // than fabricated numbers.
    return variant === 'primary'
      ? {
          bg: 'primary.500',
          fg: 'fg.onPrimary',
          radius: 'md',
          padding: '10px 16px',
          font: 'sm/500',
          elevation: fallbackElevationLevel(ctx.elevation),
          states: { hover: { bg: 'primary.400' }, active: { bg: 'primary.600' }, disabled: { opacity: 0.5 }, focus: { ring: '2px border.focus' } },
        }
      : {
          bg: 'transparent',
          fg: 'fg.default',
          border: '1px solid border.default',
          radius: 'md',
          padding: '10px 16px',
          states: { hover: { bg: 'bg.raised' }, focus: { ring: '2px border.focus' } },
        };
  }

  const bg = nearestColorPath(mostCommon(pool.map((s) => s.styles['background-color'])), ctx) ?? (variant === 'primary' ? 'primary.500' : 'transparent');
  const fg = nearestColorPath(mostCommon(pool.map((s) => s.styles['color'])), ctx) ?? (variant === 'primary' ? 'fg.onPrimary' : 'fg.default');
  const radius = nearestRadiusKey(mostCommon(pool.map((s) => s.styles['border-radius'])), ctx.shape.radius) ?? 'md';
  const padding = mostCommon(pool.map((s) => s.styles['padding'])) ?? '10px 16px';

  const fontSize = parseFloat(mostCommon(pool.map((s) => s.styles['font-size'])) ?? '');
  const weight = mostCommon(pool.map((s) => s.styles['font-weight'])) ?? '500';
  const fontStep = !Number.isNaN(fontSize) ? nearestFontStep(fontSize, ctx.typography.scale.steps) : undefined;
  const font = `${fontStep ?? 'sm'}/${weight}`;

  const shadowSample = mostCommon(pool.map((s) => s.styles['box-shadow']));
  const elevationLevel = nearestElevationLevel(shadowSample, ctx.elevation.levels);

  const borderWidth = mostCommon(pool.map((s) => s.styles['border-width']));
  const border =
    variant === 'secondary' && borderWidth && borderWidth !== '0px'
      ? `${borderWidth} solid ${nearestColorPath(mostCommon(pool.map((s) => s.styles['border-color'])), ctx) ?? 'border.default'}`
      : undefined;

  const hoverDelta = findStateDelta(allSamples, '::state:hover', /button|\bbtn\b/i, ctx, new Set(pool.map((s) => s.selector)));
  const recipe: ComponentRecipe = {
    bg,
    fg,
    radius,
    padding,
    font,
    ...(elevationLevel !== '0' ? { elevation: elevationLevel } : {}),
    ...(border ? { border } : {}),
    states: {
      hover: hoverDelta ?? (variant === 'primary' ? { bg: shiftRampStep(bg, -1) ?? 'primary.400' } : { bg: 'bg.raised' }),
      ...(variant === 'primary' ? { active: { bg: shiftRampStep(bg, 1) ?? 'primary.600' } } : {}),
      disabled: { opacity: 0.5 },
      focus: { ring: '2px border.focus' },
    },
  };
  return recipe;
}

function buildInputRecipe(inputSamples: RawCapture['computedStyles'], allSamples: RawCapture['computedStyles'], ctx: ComponentDeriveContext): ComponentRecipe {
  const samples = inputSamples ?? [];
  if (samples.length === 0) {
    return {
      bg: 'bg.surface',
      fg: 'fg.default',
      border: '1px solid border.default',
      radius: 'sm',
      padding: '8px 12px',
      states: { focus: { ring: '2px border.focus', border: 'primary.400' }, disabled: { opacity: 0.5 } },
    };
  }

  const bg = nearestColorPath(mostCommon(samples.map((s) => s.styles['background-color'])), ctx) ?? 'bg.surface';
  const fg = nearestColorPath(mostCommon(samples.map((s) => s.styles['color'])), ctx) ?? 'fg.default';
  const radius = nearestRadiusKey(mostCommon(samples.map((s) => s.styles['border-radius'])), ctx.shape.radius) ?? 'sm';
  const padding = mostCommon(samples.map((s) => s.styles['padding'])) ?? '8px 12px';
  const borderWidth = mostCommon(samples.map((s) => s.styles['border-width'])) || '1px';
  const borderColor = nearestColorPath(mostCommon(samples.map((s) => s.styles['border-color'])), ctx) ?? 'border.default';

  const focusDelta = findStateDelta(allSamples, '::state:focus', /input|textarea|select/i, ctx, new Set(samples.map((s) => s.selector)));

  return {
    bg,
    fg,
    border: `${borderWidth} solid ${borderColor}`,
    radius,
    padding,
    states: {
      focus: focusDelta ?? { ring: '2px border.focus', border: 'primary.400' },
      disabled: { opacity: 0.5 },
    },
  };
}

function buildCardRecipe(cardSamples: RawCapture['computedStyles'], ctx: ComponentDeriveContext): ComponentRecipe {
  const samples = cardSamples ?? [];
  if (samples.length === 0) {
    return {
      bg: 'bg.surface',
      border: ctx.elevation.strategy !== 'shadow' ? '1px solid border.default' : undefined,
      radius: 'lg',
      elevation: fallbackElevationLevel(ctx.elevation),
    };
  }

  const bg = nearestColorPath(mostCommon(samples.map((s) => s.styles['background-color'])), ctx) ?? 'bg.surface';
  const radius = nearestRadiusKey(mostCommon(samples.map((s) => s.styles['border-radius'])), ctx.shape.radius) ?? 'lg';
  const shadowSample = mostCommon(samples.map((s) => s.styles['box-shadow']));
  const elevationLevel = nearestElevationLevel(shadowSample, ctx.elevation.levels);
  const borderWidth = mostCommon(samples.map((s) => s.styles['border-width']));
  const border =
    borderWidth && borderWidth !== '0px'
      ? `${borderWidth} solid ${nearestColorPath(mostCommon(samples.map((s) => s.styles['border-color'])), ctx) ?? 'border.default'}`
      : undefined;

  return {
    bg,
    ...(border ? { border } : {}),
    radius,
    ...(elevationLevel !== '0' ? { elevation: elevationLevel } : {}),
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

function countBy<T>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

function pxToRem(px: number): string {
  return `${round2(px / 16)}rem`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
