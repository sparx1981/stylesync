import { lapaNinjaAdapter } from './lapaNinjaAdapter.js';
import { figmaAdapter } from './figmaAdapter.js';
import { urlAdapter } from './urlAdapter.js';
import { saasPagesAdapter } from './saasPagesAdapter.js';
import { godlyAdapter } from './godlyAdapter.js';
import { bananiAdapter } from './bananiAdapter.js';
import { designSpellsAdapter } from './designSpellsAdapter.js';
import type { SourceAdapter } from './types.js';

export const ADAPTERS: Record<string, SourceAdapter> = {
  [lapaNinjaAdapter.id]: lapaNinjaAdapter,
  [figmaAdapter.id]: figmaAdapter,
  [urlAdapter.id]: urlAdapter,
  [saasPagesAdapter.id]: saasPagesAdapter,
  [godlyAdapter.id]: godlyAdapter,
  [bananiAdapter.id]: bananiAdapter,
  [designSpellsAdapter.id]: designSpellsAdapter,
};

export function getAdapter(id: string): SourceAdapter | undefined {
  return ADAPTERS[id];
}

export function listAdapters(): SourceAdapter[] {
  return Object.values(ADAPTERS);
}
