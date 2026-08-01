import { runCaptureRoutine } from './captureRoutine.js';
import { loadSourceConfig } from './sourceConfig.js';
import { contentHash } from '../util/hash.js';
import type { CrawlContext, DiscoveredItem, HealthReport, RawCapture, SourceAdapter } from './types.js';
import { RateLimiter } from './types.js';

const cfg = loadSourceConfig('design-spells');
const listing = cfg.listing as { sitemap_path: string; item_limit: number };

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; StyleSyncBot/2.0; +personal, low-rate, single-user tool)',
    },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

function titleFromSlug(slug: string): string {
  const words = slug.split('-');
  return words.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

// Design Spells (designspells.com) catalogues individual UI micro-
// interactions ("spells"), each with its own /spells/{slug} page containing
// a real captured video of the interaction. Its homepage is client-rendered
// (a plain fetch returns 0 /spells/ links even though the browser shows
// ~300+), so — same fix as Godly/Recent — discovery reads the site's own
// sitemap.xml instead of scraping the page.
export const designSpellsAdapter: SourceAdapter = {
  id: 'design-spells',
  displayName: 'Design Spells',
  category: 'motion',
  accessMethod: 'sitemap',
  baseUrl: 'https://designspells.com',
  rpm: cfg.rpm,

  async *discover(ctx: CrawlContext): AsyncIterable<DiscoveredItem> {
    const limiter = new RateLimiter(ctx.rpm);
    await limiter.wait();
    const url = new URL(listing.sitemap_path, this.baseUrl).toString();
    let xml: string;
    try {
      xml = await fetchText(url);
    } catch (err) {
      ctx.log(`design-spells: sitemap fetch failed: ${(err as Error).message}`);
      return;
    }
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]).filter((l) => l.includes('/spells/'));
    if (locs.length === 0) {
      ctx.log(`design-spells: sitemap at ${url} contained no /spells/ entries — site structure may have changed, check config/sources/design-spells.yaml`);
      return;
    }
    for (const originUrl of locs.slice(0, listing.item_limit)) {
      const slug = originUrl.split('/spells/')[1]?.replace(/\/$/, '');
      if (!slug) continue;
      yield { externalId: slug, originUrl, title: titleFromSlug(slug) };
    }
  },

  async signature(item: DiscoveredItem): Promise<string> {
    try {
      const html = await fetchText(item.originUrl);
      return contentHash(html);
    } catch {
      return contentHash(item.originUrl + (item.title ?? ''));
    }
  },

  async capture(item: DiscoveredItem, ctx: CrawlContext): Promise<RawCapture> {
    const limiter = new RateLimiter(ctx.rpm);
    await limiter.wait();
    // captureMotion: true — every spell page centres on a real captured
    // video of the interaction, so a short screen recording (same
    // mechanism used for Godly/Recent) preserves that rather than a static
    // screenshot of one frame.
    return runCaptureRoutine({
      url: item.originUrl,
      externalId: item.externalId,
      title: item.title,
      creatorCredit: 'via Design Spells',
      captureMotion: true,
    });
  },

  async health(): Promise<HealthReport> {
    try {
      const url = new URL(listing.sitemap_path, this.baseUrl).toString();
      const xml = await fetchText(url);
      const ok = /\/spells\//.test(xml);
      return {
        ok,
        message: ok ? 'sitemap reachable and contains /spells/ entries' : 'sitemap reachable but no /spells/ entries found — site structure likely changed',
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { ok: false, message: (err as Error).message, checkedAt: new Date().toISOString() };
    }
  },
};
