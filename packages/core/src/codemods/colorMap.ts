import { differenceEuclidean, converter } from 'culori';
import type { DRP } from '../drp/types.js';

const toOklch = converter('oklch');
const diff = differenceEuclidean('oklch');

export interface TokenMatch {
  varName: string;
  hex: string;
  distance: number;
}

export function nearestToken(rawColor: string, drp: DRP, preserveBrand: string[] = []): TokenMatch | undefined {
  const normalized = rawColor.trim().toLowerCase();
  if (preserveBrand.some((hex) => hex.toLowerCase() === normalized)) return undefined;

  const target = toOklch(rawColor);
  if (!target) return undefined;

  let best: TokenMatch | undefined;
  for (const [role, ramp] of Object.entries(drp.color.palette)) {
    if (!ramp) continue;
    for (const [step, hex] of Object.entries(ramp.ramp)) {
      const candidate = toOklch(hex);
      if (!candidate) continue;
      const distance = diff(target, candidate);
      if (!best || distance < best.distance) {
        best = { varName: `--color-${role}-${step}`, hex, distance };
      }
    }
  }
  return best;
}

export const COLOR_LITERAL_RE = /#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
