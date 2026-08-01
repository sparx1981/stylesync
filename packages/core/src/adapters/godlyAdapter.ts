import { runCaptureRoutine } from './captureRoutine.js';
import { loadSourceConfig } from './sourceConfig.js';
import { contentHash } from '../util/hash.js';
import type { CrawlContext, DiscoveredItem, HealthReport, RawCapture, SourceAdapter } from './types.js';
import { RateLimiter } from './types.js';

const cfg = loadSourceConfig('godly');
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
  // slugs look like "htqifu7-gradient-motion-study" — strip the leading
  // short id and title-case the rest.
  const words = slug.replace(/^[a-z0-9]{6,8}-/, '').split('-');
  return words.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

// Godly rebranded to "Recent" (recent.design) partway through this tool's
// life — the adapter id stays "godly" for ref/DRP continuity, but points at
// the new domain. Recent curates individual motion/UI/branding shots (each
// with its own /i/{slug} page, often an animated .webp) rather than full
// sites, so discovery reads the site's own sitemap.xml instead of scraping
// a paginated listing — much more stable against redesigns.
export const godlyAdapter: SourceAdapter = {
  id: 'godly',
  displayName: 'Recent (formerly Godly)',
  category: 'motion',
  accessMethod: 'sitemap',
  baseUrl: 'https://recent.design',
  rpm: cfg.rpm,

  async *discover(ctx: CrawlContext): AsyncIterable<DiscoveredItem> {
    const limiter = new RateLimiter(ctx.rpm);
    await limiter.wait();
    const url = new URL(listing.sitemap_path, this.baseUrl).toString();
    let xml: string;
    try {
      xml = await fetchText(url);
    } catch (err) {
      ctx.log(`godly: sitemap fetch failed: ${(err as Error).message}`);
      return;
    }
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]).filter((l) => l.includes('/i/'));
    if (locs.length === 0) {
      ctx.log(`godly: sitemap at ${url} contained no /i/ entries — site structure may have changed, check config/sources/godly.yaml`);
      return;
    }
    for (const originUrl of locs.slice(0, listing.item_limit)) {
      const slug = originUrl.split('/i/')[1]?.replace(/\/$/, '');
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
    // captureMotion: true — the reason this source exists at all is
    // motion/micro-interaction reference; the animated media on these pages
    // (often an animated .webp) plays in real time, so a short screen
    // recording captures it the same way it would a video element.
    return runCaptureRoutine({
      url: item.originUrl,
      externalId: item.externalId,
      title: item.title,
      creatorCredit: 'via Recent (recent.design)',
      captureMotion: true,
    });
  },

  async health(): Promise<HealthReport> {
    try {
      const url = new URL(listing.sitemap_path, this.baseUrl).toString();
      const xml = await fetchText(url);
      const ok = /\/i\//.test(xml);
      return {
        ok,
        message: ok ? 'sitemap reachable and contains /i/ entries' : 'sitemap reachable but no /i/ entries found — site structure likely changed',
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { ok: false, message: (err as Error).message, checkedAt: new Date().toISOString() };
    }
  },
};
