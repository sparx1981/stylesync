import { converter } from 'culori';

const toRgb = converter('rgb');

function relLuminanceChannel(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(cssColor: string): number {
  const rgb = toRgb(cssColor);
  if (!rgb) return 0;
  const r = relLuminanceChannel(rgb.r);
  const g = relLuminanceChannel(rgb.g);
  const b = relLuminanceChannel(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export const WCAG_AA_BODY_TEXT_MIN = 4.5;
