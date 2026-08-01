import type { DRP } from '../drp/types.js';

export function renderStylepackMd(drp: DRP): string {
  const colorRows = Object.entries(drp.color.semantic)
    .map(([role, value]) => `| \`${role}\` | ${value} |`)
    .join('\n');

  const typeRows = Object.entries(drp.typography.scale.steps)
    .map(([name, step]) => `| ${name} | ${step.size} | ${step.line} | ${step.tracking} | ${step.weight} |`)
    .join('\n');

  const spacingRow = drp.space.scale.join(', ');

  const recipesRows = Object.entries(drp.components)
    .filter(([, r]) => r)
    .map(([role, recipe]) => `- **\`${role}\`**: ${Object.entries(recipe!)
      .filter(([k]) => k !== 'states')
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`)
    .join('\n');

  const antiPatterns = drp.anti_patterns.map((p) => `- ${p}`).join('\n');

  return `# Design System: ${drp.identity.name}

## How to use this file
You are restyling an existing application. Apply the system below.
Change only presentation. Never change logic, data flow, props, handlers,
routes, copy, or test ids. Use only the tokens defined here — never invent
a colour, size, radius, or font.

## Aesthetic direction
${drp.identity.character}

Descriptors: ${drp.identity.descriptors.join(', ')}. Theme: ${drp.identity.theme_mode}. Density: ${drp.identity.density}.

## Rules (in priority order)
1. Every colour comes from the token table below. No raw hex.
2. Every spacing value is a multiple of ${drp.space.unit_px}px, from the scale: ${spacingRow}.
3. Body text is ${drp.typography.scale.steps.base?.size ?? '1rem'}; headings step through the scale — never arbitrary sizes.
4. Elevation strategy is "${drp.elevation.strategy}"${drp.elevation.strategy === 'border' ? ' — do not add box-shadows' : ''}.
5. Every interactive element has hover, active, focus-visible, and disabled states.
6. Focus rings are always visible, using \`border.focus\` (${drp.color.semantic['border.focus'] ?? 'primary.400'}).
7. Transitions are ${drp.motion.durations.base}ms ${drp.motion.easings.standard}. Nothing animates longer than ${drp.motion.durations.slow}ms.
8. Respect prefers-reduced-motion: fall back to ${drp.motion.reduced_motion_fallback}.

## Tokens

### Colour (semantic)
| Role | Value |
|---|---|
${colorRows}

### Type scale
| Step | Size | Line height | Tracking | Weight |
|---|---|---|---|---|
${typeRows}

### Spacing
Unit: ${drp.space.unit_px}px. Scale (× unit): ${spacingRow}. Section rhythm: ${drp.space.section_rhythm_px}px.

### Radii & borders
${Object.entries(drp.shape.radius).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')}

### Elevation
Strategy: **${drp.elevation.strategy}**.
${Object.entries(drp.elevation.levels).map(([k, v]) => `- level ${k}: \`${v}\``).join('\n')}

## Component recipes
${recipesRows || '_No structured recipes extracted — infer visually from reference/screenshot.png, staying inside the token rules above._'}

See \`components.md\` for the full per-state breakdown.

## Anti-patterns for this system
${antiPatterns || '_None flagged._'}

## Provenance
Source: ${drp.provenance.source} · ${drp.provenance.origin_url}
Creator: ${drp.provenance.creator_credit}
Extraction method: ${drp.provenance.extraction_method} · confidence ${drp.provenance.confidence.toFixed(2)}
Captured: ${drp.provenance.captured_at}
`;
}
