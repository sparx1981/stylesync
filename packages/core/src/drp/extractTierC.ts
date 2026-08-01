import Anthropic from '@anthropic-ai/sdk';
import type { RawCapture } from '../adapters/types.js';
import type { DRP } from './types.js';
import { formatHex, generateRamp, parseToOklch } from './oklch.js';
import { contrastRatio } from '../util/contrast.js';

const VISION_SCHEMA_PROMPT = `You are extracting a design system from a screenshot for a personal design-reference
tool. Look at the attached UI screenshot and respond with ONLY minified JSON matching this shape,
no prose:
{
  "theme_mode": "light" | "dark",
  "primary_hex": "#RRGGBB",
  "neutral_hex": "#RRGGBB",
  "accent_hex": "#RRGGBB" | null,
  "base_font_px": number,
  "type_ratio": 1.125 | 1.2 | 1.25 | 1.333 | 1.5,
  "radius_px": number,
  "elevation_strategy": "border" | "shadow" | "mixed",
  "descriptors": string[] (3-6 short adjectives, e.g. "dark", "data-dense", "geometric"),
  "character": string (one sentence, plain language)
}
Base every field on what's actually visible. If you are unsure of an exact hex, estimate from the
dominant pixels you can see — do not invent a value that contradicts the image.`;

export async function extractTierC(capture: RawCapture, refId: string, sourceId: string): Promise<DRP> {
  if (!capture.screenshotPng) {
    throw new Error(`extractTierC requires a screenshot; ${refId} has none.`);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set — Tier C vision extraction needs a Claude API key.');
  }

  const client = new Anthropic({ apiKey });
  const base64 = capture.screenshotPng.toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
          { type: 'text', text: VISION_SCHEMA_PROMPT },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Vision model returned no text block.');
  }

  const parsed = JSON.parse(extractJson(textBlock.text)) as {
    theme_mode: 'light' | 'dark';
    primary_hex: string;
    neutral_hex: string;
    accent_hex: string | null;
    base_font_px: number;
    type_ratio: number;
    radius_px: number;
    elevation_strategy: 'border' | 'shadow' | 'mixed';
    descriptors: string[];
    character: string;
  };

  const primaryOklch = parseToOklch(parsed.primary_hex)!;
  const neutralOklch = parseToOklch(parsed.neutral_hex)!;

  const palette: DRP['color']['palette'] = {
    primary: { base: formatHex(primaryOklch), ramp: generateRamp(primaryOklch) },
    neutral: { base: formatHex(neutralOklch), ramp: generateRamp(neutralOklch) },
  };
  if (parsed.accent_hex) {
    const accentOklch = parseToOklch(parsed.accent_hex)!;
    palette.accent = { base: formatHex(accentOklch), ramp: generateRamp(accentOklch) };
  }

  const isDark = parsed.theme_mode === 'dark';
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
      source: sourceId,
      origin_url: capture.originUrl,
      creator_credit: capture.creatorCredit ?? 'Unknown',
      captured_at: capture.capturedAt,
      extraction_method: 'vision_inferred',
      confidence: 0.6,
    },
    identity: { name: capture.title ?? refId, descriptors: parsed.descriptors, theme_mode: parsed.theme_mode, density: 'comfortable', character: parsed.character },
    color: { palette, semantic, contrast_report: { min_body_ratio: round2(minBodyRatio), wcag_aa_pass: minBodyRatio >= 4.5, contrast_adjusted: false } },
    typography: {
      families: {
        display: { stack: 'system-ui, sans-serif', source: 'system', weights: [600, 700] },
        body: { stack: 'system-ui, sans-serif', source: 'system', weights: [400, 500] },
        mono: { stack: 'ui-monospace, monospace', source: 'system', weights: [400] },
      },
      scale: { ratio: parsed.type_ratio, base_px: parsed.base_font_px, steps: buildStepsFromRatio(parsed.base_font_px, parsed.type_ratio) },
    },
    space: { unit_px: 4, scale: [0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64], section_rhythm_px: 96 },
    shape: {
      radius: { none: '0', sm: `${Math.max(2, Math.round(parsed.radius_px * 0.5))}px`, md: `${parsed.radius_px}px`, lg: `${Math.round(parsed.radius_px * 1.6)}px`, pill: '9999px' },
      border_widths: { hairline: '1px', emphasis: '2px' },
    },
    elevation: { strategy: parsed.elevation_strategy, levels: { '0': 'none', '1': '0 1px 2px rgb(0 0 0 / .24)', '2': '0 4px 12px rgb(0 0 0 / .28)', '3': '0 12px 32px rgb(0 0 0 / .36)' } },
    motion: {
      durations: { fast: 120, base: 200, slow: 360 },
      easings: { standard: 'cubic-bezier(.2,0,0,1)', entrance: 'cubic-bezier(0,0,0,1)', exit: 'cubic-bezier(.3,0,1,1)' },
      signatures: [],
      reduced_motion_fallback: 'opacity-only',
    },
    layout: { container_max_px: 1200, grid: { columns: 12, gutter_px: 24 }, breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 }, nav_pattern: 'topbar', content_alignment: 'left' },
    components: {},
    anti_patterns: [
      parsed.elevation_strategy === 'border' ? 'Do not add box-shadows to cards — this system separates surfaces with hairline borders.' : 'Keep shadow elevation subtle and consistent across surfaces.',
    ],
    assets_policy: { may_emit_fonts: true, may_emit_images: false, may_emit_icons: false },
  };
}

function buildStepsFromRatio(basePx: number, ratio: number) {
  const names = ['xs', 'sm', 'base', 'lg', 'xl', '2xl'];
  const offsets = [-2, -1, 0, 1, 2, 3];
  const steps: DRP['typography']['scale']['steps'] = {};
  for (let i = 0; i < names.length; i++) {
    const sizePx = basePx * ratio ** offsets[i];
    steps[names[i]] = {
      size: `${round2(sizePx / 16)}rem`,
      line: offsets[i] <= 0 ? 1.5 : 1.25,
      tracking: offsets[i] > 1 ? '-0.02em' : '0',
      weight: offsets[i] >= 2 ? 700 : offsets[i] >= 1 ? 600 : 400,
    };
  }
  return steps;
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Vision model response contained no JSON object.');
  return text.slice(start, end + 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
