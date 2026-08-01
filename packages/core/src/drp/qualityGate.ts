import type { DRP } from './types.js';
import { contrastRatio } from '../util/contrast.js';

export interface QualityGateResult {
  passed: boolean;
  warnings: string[];
  drp: DRP;
}

export function validateQualityGate(input: DRP): QualityGateResult {
  const drp: DRP = JSON.parse(JSON.stringify(input));
  const warnings: string[] = [];

  const paletteRoles = Object.keys(drp.color.palette).length;
  if (paletteRoles < 3) {
    warnings.push(`Only ${paletteRoles} palette role(s) extracted (gate requires >= 3) — confidence should be treated as low.`);
  }

  const typeSteps = Object.keys(drp.typography.scale.steps).length;
  if (typeSteps < 4) {
    warnings.push(`Only ${typeSteps} type scale step(s) (gate requires >= 4).`);
  }

  if (!drp.space.unit_px || drp.space.unit_px <= 0) {
    warnings.push('No spacing unit detected.');
  }

  let ratio = contrastRatio(drp.color.semantic['fg.default'], drp.color.semantic['bg.canvas']);
  if (ratio < 4.5) {
    warnings.push(`fg.default on bg.canvas contrast is ${ratio.toFixed(2)}:1, below WCAG AA (4.5:1) — auto-correcting lightness.`);
    const corrected = drp.identity.theme_mode === 'dark' ? '#FAFAFA' : '#09090B';
    drp.color.semantic['fg.default'] = corrected;
    ratio = contrastRatio(corrected, drp.color.semantic['bg.canvas']);
    drp.color.contrast_report.contrast_adjusted = true;
  }
  drp.color.contrast_report.min_body_ratio = Math.round(ratio * 100) / 100;
  drp.color.contrast_report.wcag_aa_pass = ratio >= 4.5;

  const structurallyValid = paletteRoles >= 3 && typeSteps >= 4 && drp.space.unit_px > 0;
  const passed = structurallyValid && drp.color.contrast_report.wcag_aa_pass;

  return { passed, warnings, drp };
}
