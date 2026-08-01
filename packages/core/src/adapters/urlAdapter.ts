import { runCaptureRoutine } from './captureRoutine.js';
import { contentHash } from '../util/hash.js';
import type { CrawlContext, DiscoveredItem, HealthReport, RawCapture, SourceAdapter } from './types.js';

export const urlAdapter: SourceAdapter = {
  id: 'url',
  displayName: 'Ad-hoc URL',
  category: 'web',
  accessMethod: 'headless',
  baseUrl: '',
  rpm: 6,

  async *discover(ctx: CrawlContext): AsyncIterable<DiscoveredItem> {
    const urls = (ctx.config.urls as string[] | undefined) ?? [];
    for (const url of urls) {
      yield { externalId: slugFromUrl(url), originUrl: url };
    }
  },

  async signature(item: DiscoveredItem): Promise<string> {
    return contentHash(item.originUrl);
  },

  async capture(item: DiscoveredItem): Promise<RawCapture> {
    return runCaptureRoutine({ url: item.originUrl, externalId: item.externalId });
  },

  async health(): Promise<HealthReport> {
    return { ok: true, message: 'always available — no fixed endpoint to check', checkedAt: new Date().toISOString() };
  },
};

function slugFromUrl(url: string): string {
  const u = new URL(url);
  return (u.hostname + u.pathname).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 64);
}
