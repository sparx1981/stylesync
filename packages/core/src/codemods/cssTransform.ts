import postcss from 'postcss';
import type { DRP } from '../drp/types.js';
import { nearestToken, COLOR_LITERAL_RE } from './colorMap.js';
import { MutationLog } from './mutationGuard.js';

export interface CssTransformOptions {
  preserveBrand?: string[];
  only?: Set<'colors' | 'radius' | 'shadow' | 'spacing' | 'motion'>;
  intensity?: 'conservative' | 'balanced' | 'bold';
}

export interface CssTransformResult {
  css: string;
  changedDeclarations: number;
}

const RADIUS_PROPS = new Set(['border-radius']);
const SHADOW_PROPS = new Set(['box-shadow']);
const SPACING_PROPS = new Set(['padding', 'margin', 'gap', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right']);

export function transformCss(filePath: string, source: string, drp: DRP, log: MutationLog, opts: CssTransformOptions = {}): CssTransformResult {
  const only = opts.only;
  const root = postcss.parse(source, { from: filePath });
  let changed = 0;

  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();

    if ((!only || only.has('colors')) && COLOR_LITERAL_RE.test(decl.value)) {
      decl.value = decl.value.replace(COLOR_LITERAL_RE, (match) => {
        const token = nearestToken(match, drp, opts.preserveBrand);
        if (!token) return match;
        log.record({ filePath, kind: 'css-declaration', description: `${prop}: ${match} -> var(${token.varName})` });
        changed++;
        return `var(${token.varName})`;
      });
    }
    COLOR_LITERAL_RE.lastIndex = 0;

    if ((!only || only.has('radius')) && RADIUS_PROPS.has(prop)) {
      const nearestRadius = nearestRadiusToken(decl.value, drp);
      if (nearestRadius) {
        log.record({ filePath, kind: 'css-declaration', description: `${prop}: ${decl.value} -> var(${nearestRadius})` });
        decl.value = `var(${nearestRadius})`;
        changed++;
      }
    }

    if ((!only || only.has('shadow')) && SHADOW_PROPS.has(prop) && decl.value !== 'none') {
      if (drp.elevation.strategy === 'border') {
        log.record({ filePath, kind: 'css-declaration', description: `${prop}: removed (elevation strategy is border, not shadow)` });
        decl.value = 'none';
        changed++;
      } else {
        log.record({ filePath, kind: 'css-declaration', description: `${prop}: ${decl.value} -> var(--elevation-1)` });
        decl.value = 'var(--elevation-1)';
        changed++;
      }
    }

    if ((!only || only.has('spacing')) && SPACING_PROPS.has(prop)) {
      const snapped = snapSpacing(decl.value, drp.space.unit_px, drp.space.scale);
      if (snapped && snapped !== decl.value) {
        log.record({ filePath, kind: 'css-declaration', description: `${prop}: ${decl.value} -> ${snapped}` });
        decl.value = snapped;
        changed++;
      }
    }

    if ((!only || only.has('motion')) && prop === 'transition-duration') {
      log.record({ filePath, kind: 'css-declaration', description: `${prop}: ${decl.value} -> var(--motion-base)` });
      decl.value = 'var(--motion-base)';
      changed++;
    }
  });

  return { css: root.toString(), changedDeclarations: changed };
}

function nearestRadiusToken(value: string, drp: DRP): string | undefined {
  const px = parseFloat(value);
  if (Number.isNaN(px)) return undefined;
  let best: { name: string; diff: number } | undefined;
  for (const [name, tokenValue] of Object.entries(drp.shape.radius)) {
    const tokenPx = parseFloat(tokenValue);
    if (Number.isNaN(tokenPx)) continue;
    const diff = Math.abs(tokenPx - px);
    if (!best || diff < best.diff) best = { name, diff };
  }
  return best ? `--radius-${best.name}` : undefined;
}

function snapSpacing(value: string, unitPx: number, scale: number[]): string | undefined {
  const parts = value.split(/\s+/);
  const snappedParts = parts.map((part) => {
    const px = parseFloat(part);
    if (Number.isNaN(px) || !part.endsWith('px')) return part;
    let best = scale[0];
    let bestDiff = Infinity;
    for (const step of scale) {
      const diff = Math.abs(step - px);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = step;
      }
    }
    return bestDiff <= 2 ? `${best}px` : part;
  });
  const result = snappedParts.join(' ');
  return result === value ? undefined : result;
}
