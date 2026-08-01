export type MutationKind =
  | 'css-declaration'
  | 'css-root-token'
  | 'class-string-literal'
  | 'style-object-literal'
  | 'tailwind-theme-key'
  | 'token-file'
  | 'styled-template-literal'
  | 'aria-attribute-add';

export interface MutationTarget {
  filePath: string;
  kind: MutationKind;
  identifier?: string;
  description: string;
}

const FORBIDDEN_IDENTIFIERS = new Set(['key', 'ref', 'data-testid', 'id', 'name', 'onClick', 'onChange', 'onSubmit']);
const FORBIDDEN_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /package\.json$/,
  /pnpm-lock\.yaml$/,
  /package-lock\.json$/,
  /\.github\//,
  /vite\.config\./,
  /next\.config\./,
  /tsconfig.*\.json$/,
];
const ALLOWED_STYLE_FILE = /\.(css|scss|module\.css|module\.scss)$/;

export class MutationGuardViolation extends Error {
  constructor(public target: MutationTarget, reason: string) {
    super(`MutationGuard blocked write to ${target.filePath} (${target.kind}${target.identifier ? `:${target.identifier}` : ''}): ${reason}`);
    this.name = 'MutationGuardViolation';
  }
}

export function assertAllowed(target: MutationTarget): void {
  for (const pattern of FORBIDDEN_FILE_PATTERNS) {
    if (pattern.test(target.filePath)) {
      throw new MutationGuardViolation(target, `file matches forbidden pattern ${pattern}`);
    }
  }

  if (target.identifier && FORBIDDEN_IDENTIFIERS.has(target.identifier)) {
    throw new MutationGuardViolation(target, `identifier "${target.identifier}" is in the forbidden write set`);
  }

  switch (target.kind) {
    case 'css-declaration':
    case 'css-root-token':
      if (!ALLOWED_STYLE_FILE.test(target.filePath)) {
        throw new MutationGuardViolation(target, 'css-kind mutation targeting a non-stylesheet file');
      }
      return;
    case 'class-string-literal':
      if (target.identifier && !['class', 'className', ':class'].includes(target.identifier)) {
        throw new MutationGuardViolation(target, 'class-string-literal mutation must target class/className/:class');
      }
      return;
    case 'style-object-literal':
    case 'tailwind-theme-key':
    case 'token-file':
    case 'styled-template-literal':
    case 'aria-attribute-add':
      return;
    default:
      throw new MutationGuardViolation(target, `unknown mutation kind`);
  }
}

export class MutationLog {
  private entries: MutationTarget[] = [];
  record(target: MutationTarget) {
    assertAllowed(target);
    this.entries.push(target);
  }
  all(): MutationTarget[] {
    return [...this.entries];
  }
  countByFile(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of this.entries) counts[e.filePath] = (counts[e.filePath] ?? 0) + 1;
    return counts;
  }
}
