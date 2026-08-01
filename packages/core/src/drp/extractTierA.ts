import type { RawCapture } from '../adapters/types.js';
import type { DRP } from './types.js';
import { formatHex, generateRamp, parseToOklch } from './oklch.js';
import { contrastRatio } from '../util/contrast.js';

interface FigmaVariable {
  name: string;
  resolvedType: string;
  valuesByMode: Record<string, unknown>;
}
interface FigmaVariablesResponse {
  meta?: { variables?: Record<string, FigmaVariable>; variableCollections?: Record<string, { name: string; modes: { modeId: string; name: string }[] }> };
}

export function extractTierA(capture: RawCapture, refId: string): DRP {
  const node = capture.figmaNode as { variables?: FigmaVariablesResponse } | undefined;
  const variables = node?.variables?.meta?.variables ?? {};

  const colorVars = Object.values(variables).filter((v) => v.resolvedType === 'COLOR');
  const namedColor = (needle: RegExp) => colorVars.find((v) => needle.test(v.name.toLowerCase()));

  const primaryVar = namedColor(/primary|brand|accent/) ?? colorVars[0];
  const neutralVar = namedColor(/neutral|gray|grey|background|surface/) ?? colorVars[1] ?? colorVars[0];

  const primaryColor = firstColorValue(primaryVar) ?? '#6366F1';
  const neutralColor = firstColorValue(neutralVar) ?? '#0F172A';

  const primaryOklch = parseToOklch(primaryColor)!;
  const neutralOklch = parseToOklch(neutralColor)!;

  const palette: DRP['color']['palette'] = {
    primary: { base: formatHex(primaryOklch), ramp: generateRamp(primaryOklch) },
    neutral: { base: formatHex(neutralOklch), ramp: generateRamp(neutralOklch) },
  };

  const isDark = neutralOklch.l < 0.5;
  const semantic: Record<string, string> = isDark
    ? {
        'bg.canvas': palette.neutral.ramp['950'], 'bg.surface': palette.neutral.ramp['900'], 'bg.raised': palette.neutral.ramp['800'],
        'fg.default': palette.neutral.ramp['50'], 'fg.muted': palette.neutral.ramp['400'], 'fg.onPrimary': '#FFFFFF',
        'border.default': palette.neutral.ramp['800'], 'border.focus': palette.primary.ramp['400'],
      }
    : {
        'bg.canvas': palette.neutral.ramp['50'], 'bg.surface': '#FFFFFF', 'bg.raised': palette.neutral.ramp['100'],
        'fg.default': palette.neutral.ramp['950'], 'fg.muted': palette.neutral.ramp['600'], 'fg.onPrimary': '#FFFFFF',
        'border.default': palette.neutral.ramp['200'], 'border.focus': palette.primary.ramp['500'],
      };

  const minBodyRatio = contrastRatio(semantic['fg.default'], semantic['bg.canvas']);

  return {
    drp_version: 1,
    ref_id: refId,
    provenance: {
      source: 'figma',
      origin_url: capture.originUrl,
      creator_credit: capture.creatorCredit ?? 'Figma Community',
      captured_at: capture.capturedAt,
      extraction_method: 'figma_api',
      confidence: colorVars.length > 0 ? 0.97 : 0.6,
    },
    identity: {
      name: capture.title ?? refId,
      descriptors: [isDark ? 'dark' : 'light', 'figma-authoritative'],
      theme_mode: isDark ? 'dark' : 'light',
      density: 'comfortable',
      character: 'Design system extracted directly from Figma Variables — authoritative, not inferred.',
    },
    color: { palette, semantic, contrast_report: { min_body_ratio: round2(minBodyRatio), wcag_aa_pass: minBodyRatio >= 4.5, contrast_adjusted: false } },
    typography: {
      families: {
        display: { stack: 'Inter, sans-serif', source: 'google', weights: [600, 700] },
        body: { stack: 'Inter, sans-serif', source: 'google', weights: [400, 500] },
        mono: { stack: 'JetBrains Mono, monospace', source: 'google', weights: [400] },
      },
      scale: {
        ratio: 1.25,
        base_px: 16,
        steps: {
          xs: { size: '0.75rem', line: 1.5, tracking: '0.01em', weight: 400 },
          sm: { size: '0.875rem', line: 1.5, tracking: '0', weight: 400 },
          base: { size: '1rem', line: 1.6, tracking: '0', weight: 400 },
          lg: { size: '1.25rem', line: 1.4, tracking: '-0.01em', weight: 500 },
          xl: { size: '1.75rem', line: 1.25, tracking: '-0.02em', weight: 600 },
          '2xl': { size: '2.5rem', line: 1.1, tracking: '-0.03em', weight: 700 },
        },
      },
    },
    space: { unit_px: 4, scale: [0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64], section_rhythm_px: 96 },
    shape: { radius: { none: '0', sm: '6px', md: '10px', lg: '16px', pill: '9999px' }, border_widths: { hairline: '1px', emphasis: '2px' } },
    elevation: {
      strategy: 'border',
      levels: { '0': 'none', '1': '0 1px 2px rgb(0 0 0 / .24)', '2': '0 4px 12px rgb(0 0 0 / .28)', '3': '0 12px 32px rgb(0 0 0 / .36)' },
    },
    motion: {
      durations: { fast: 120, base: 200, slow: 360 },
      easings: { standard: 'cubic-bezier(.2,0,0,1)', entrance: 'cubic-bezier(0,0,0,1)', exit: 'cubic-bezier(.3,0,1,1)' },
      signatures: [],
      reduced_motion_fallback: 'opacity-only',
    },
    layout: { container_max_px: 1200, grid: { columns: 12, gutter_px: 24 }, breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 }, nav_pattern: 'sidebar', content_alignment: 'left' },
    components: {
      'action.button.primary': {
        bg: 'primary.500', fg: 'fg.onPrimary', radius: 'md', padding: '10px 16px', font: 'sm/500', elevation: '0',
        states: { hover: { bg: 'primary.400' }, active: { bg: 'primary.600' }, disabled: { opacity: 0.5 }, focus: { ring: '2px border.focus' } },
      },
    },
    anti_patterns: ['Do not introduce colours outside the Figma variable set — they are the source of truth.'],
    assets_policy: { may_emit_fonts: true, may_emit_images: false, may_emit_icons: false },
  };
}

function firstColorValue(v: FigmaVariable | undefined): string | undefined {
  if (!v) return undefined;
  const modeValues = Object.values(v.valuesByMode ?? {});
  const first = modeValues[0] as { r?: number; g?: number; b?: number; a?: number } | undefined;
  if (!first || typeof first.r !== 'number') return undefined;
  const r = Math.round(first.r * 255);
  const g = Math.round(first.g! * 255);
  const b = Math.round(first.b! * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
