import { Project, SyntaxKind } from 'ts-morph';
import type { DRP } from '../drp/types.js';
import { nearestToken } from './colorMap.js';
import { TAILWIND_DEFAULT_PALETTE } from './tailwindPalette.js';
import { MutationLog } from './mutationGuard.js';

const UTILITY_PREFIXES: Array<{ prefix: string; kind: 'bg' | 'text' | 'border' | 'ring' }> = [
  { prefix: 'bg-', kind: 'bg' },
  { prefix: 'text-', kind: 'text' },
  { prefix: 'border-', kind: 'border' },
  { prefix: 'ring-', kind: 'ring' },
];

export function rewriteClassList(classList: string, drp: DRP, preserveBrand: string[] = []): { result: string; changed: boolean } {
  const tokens = classList.split(/\s+/).filter(Boolean);
  let changed = false;

  const rewritten = tokens.map((token) => {
    for (const { prefix } of UTILITY_PREFIXES) {
      if (!token.startsWith(prefix)) continue;
      const rest = token.slice(prefix.length);

      const arbitraryHexMatch = /^\[#([0-9a-fA-F]{3,8})\]$/.exec(rest);
      if (arbitraryHexMatch) {
        const hex = `#${arbitraryHexMatch[1]}`;
        const match = nearestToken(hex, drp, preserveBrand);
        if (match) {
          changed = true;
          return `${prefix}[var(${match.varName})]`;
        }
        return token;
      }

      const namedMatch = /^([a-z]+)-(\d{2,3})$/.exec(rest);
      if (namedMatch) {
        const [, family, shade] = namedMatch;
        const hex = TAILWIND_DEFAULT_PALETTE[family]?.[shade];
        if (!hex) return token;
        const match = nearestToken(hex, drp, preserveBrand);
        if (match) {
          changed = true;
          return `${prefix}[var(${match.varName})]`;
        }
      }
    }

    if (/^rounded(-\w+)?$/.test(token)) {
      const size = token === 'rounded' ? 'md' : token.replace('rounded-', '');
      const radiusKey = ({ sm: 'sm', md: 'md', lg: 'lg', xl: 'lg', full: 'pill', none: 'none' } as Record<string, string>)[size];
      if (radiusKey && drp.shape.radius[radiusKey]) {
        changed = true;
        return `rounded-[var(--radius-${radiusKey})]`;
      }
    }

    if (/^shadow(-\w+)?$/.test(token) && drp.elevation.strategy === 'border') {
      changed = true;
      return '';
    }

    return token;
  });

  return { result: rewritten.filter(Boolean).join(' '), changed };
}

export function transformClassNamesInFile(filePath: string, source: string, drp: DRP, log: MutationLog, preserveBrand: string[] = []): { code: string; changed: boolean } {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 4 } });
  const sourceFile = project.createSourceFile(filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? filePath : `${filePath}.tsx`, source);

  let changed = false;

  const jsxAttributes = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute);
  for (const attr of jsxAttributes) {
    const name = attr.getNameNode().getText();
    if (name !== 'className' && name !== 'class') continue;
    const initializer = attr.getInitializer();
    if (!initializer) continue;

    if (initializer.getKind() === SyntaxKind.StringLiteral) {
      const current = (initializer as import('ts-morph').StringLiteral).getLiteralValue();
      const { result, changed: didChange } = rewriteClassList(current, drp, preserveBrand);
      if (didChange) {
        log.record({ filePath, kind: 'class-string-literal', identifier: name, description: `${current} -> ${result}` });
        (initializer as import('ts-morph').StringLiteral).setLiteralValue(result);
        changed = true;
      }
    }
  }

  return { code: sourceFile.getFullText(), changed };
}
