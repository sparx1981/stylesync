import type { DRP } from '../drp/types.js';

export function renderTokensJson(drp: DRP): string {
  const color: Record<string, unknown> = {};
  for (const [role, ramp] of Object.entries(drp.color.palette)) {
    if (!ramp) continue;
    color[role] = {};
    for (const [step, hex] of Object.entries(ramp.ramp)) {
      (color[role] as Record<string, unknown>)[step] = { $type: 'color', $value: hex };
    }
  }

  const typography: Record<string, unknown> = {};
  for (const [name, step] of Object.entries(drp.typography.scale.steps)) {
    typography[name] = { $type: 'typography', $value: { fontSize: step.size, lineHeight: step.line, letterSpacing: step.tracking, fontWeight: step.weight } };
  }

  const spacing: Record<string, unknown> = {};
  drp.space.scale.forEach((step, i) => {
    spacing[String(i)] = { $type: 'dimension', $value: `${step}px` };
  });

  const radius: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(drp.shape.radius)) {
    radius[name] = { $type: 'dimension', $value: value };
  }

  return JSON.stringify(
    { $schema: 'https://design-tokens.github.io/community-group/format/', color, typography, spacing, radius },
    null,
    2
  ) + '\n';
}
