import { createHash } from 'node:crypto';

export function contentHash(canonical: string): string {
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export function canonicalise(input: {
  dom?: string;
  computedStyles?: Array<{ selector: string; styles: Record<string, string> }>;
  stylesheetText?: string;
}): string {
  const parts: string[] = [];

  if (input.computedStyles) {
    const sorted = [...input.computedStyles].sort((a, b) => a.selector.localeCompare(b.selector));
    for (const cs of sorted) {
      const styleKeys = Object.keys(cs.styles).sort();
      const styleStr = styleKeys.map((k) => `${k}:${cs.styles[k]}`).join(';');
      parts.push(`${cs.selector}{${styleStr}}`);
    }
  }

  if (input.stylesheetText) {
    parts.push(input.stylesheetText.replace(/\s+/g, ' ').trim());
  }

  if (input.dom) {
    const stripped = input.dom
      .replace(/\snonce="[^"]*"/g, '')
      .replace(/\sdata-reactid="[^"]*"/g, '')
      .replace(/\s(id|data-[a-z-]+)="[a-z0-9_-]{8,}"/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    parts.push(stripped);
  }

  return parts.join('\n');
}

export function visualHashPlaceholder(pngBuffer: Buffer | undefined): string | undefined {
  if (!pngBuffer) return undefined;
  const bucketCount = 64;
  const bucketSize = Math.max(1, Math.floor(pngBuffer.length / bucketCount));
  const buckets: number[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const start = i * bucketSize;
    const slice = pngBuffer.subarray(start, start + bucketSize);
    let sum = 0;
    for (const byte of slice) sum += byte;
    buckets.push(slice.length ? Math.round(sum / slice.length) : 0);
  }
  const mean = buckets.reduce((a, b) => a + b, 0) / buckets.length;
  const bits = buckets.map((b) => (b >= mean ? '1' : '0')).join('');
  const hex = BigInt('0b' + bits).toString(16).padStart(16, '0');
  return 'phash:' + hex;
}
