import type { DRP, ComponentRole } from '../drp/types.js';

export function renderComponentsMd(drp: DRP): string {
  const lines: string[] = [`# Component recipes — ${drp.identity.name}`, ''];
  const entries = Object.entries(drp.components) as [ComponentRole, DRP['components'][ComponentRole]][];
  if (entries.length === 0) {
    lines.push('_No component recipes were extracted for this reference (low-confidence or vision-inferred capture)._');
    return lines.join('\n') + '\n';
  }
  for (const [role, recipe] of entries) {
    if (!recipe) continue;
    lines.push(`## \`${role}\``, '');
    lines.push('| Property | Value |', '|---|---|');
    for (const [k, v] of Object.entries(recipe)) {
      if (k === 'states' || v === undefined) continue;
      lines.push(`| ${k} | \`${v}\` |`);
    }
    if (recipe.states) {
      lines.push('', '**States:**', '');
      lines.push('| State | Change |', '|---|---|');
      for (const [state, change] of Object.entries(recipe.states)) {
        lines.push(`| ${state} | \`${JSON.stringify(change)}\` |`);
      }
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}
