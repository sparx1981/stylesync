import { lapaNinjaAdapter } from './lapaNinjaAdapter.js';
import { figmaAdapter } from './figmaAdapter.js';
import { urlAdapter } from './urlAdapter.js';
import type { SourceAdapter } from './types.js';

export const ADAPTERS: Record<string, SourceAdapter> = {
  [lapaNinjaAdapter.id]: lapaNinjaAdapter,
  [figmaAdapter.id]: figmaAdapter,
  [urlAdapter.id]: urlAdapter,
};

export function getAdapter(id: string): SourceAdapter | undefined {
  return ADAPTERS[id];
}

export function listAdapters(): SourceAdapter[] {
  return Object.values(ADAPTERS);
}
