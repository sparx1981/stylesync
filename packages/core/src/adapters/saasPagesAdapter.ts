import * as cheerio from 'cheerio';
import { runCaptureRoutine } from './captureRoutine.js';
import { loadSourceConfig } from './sourceConfig.js';
import { contentHash } from '../util/hash.js';
import type { CrawlContext, DiscoveredItem, HealthReport, RawCapture, SourceAdapter } from './types.js';
import { RateLimiter } from './types.js';

const cfg = loadSourceConfig('saas-pages');
const selectors = cfg.selectors as Record<string, string>;
const listing = cfg.listing as { path: string };

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; StyleSyncBot/2.0; +personal, low-rate, single-user tool)',
    },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

// SaaS Pages (saaspages.xyz, "by Versoly") catalogues real SaaS marketing
// sites' pages — /sites lists ~130 companies, each with its own
// /sites/{slug} breakdown page (colour palette, PageSpeed score, and the
// page broken into sections). That per-company page is itself server
// rendered and content-rich, so it's captured directly rather than trying
// to resolve each company's actual external site.
export const saasPagesAdapter: SourceAdapter = {
  id: 'saas-pages',
  displayName: 'SaaS Pages',
  category: 'web',
  accessMethod: 'sitemap',
  baseUrl: 'https://saaspages.xyz',
  rpm: cfg.rpm,

  async *discover(ctx: CrawlContext): AsyncIterable<DiscoveredItem> {
    const limiter = new RateLimiter(ctx.rpm);
    await limiter.wait();
    const url = new URL(listing.path, this.baseUrl).toString();
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      ctx.log(`saas-pages: listing fetch failed: ${(err as Error).message}`);
      return;
    }
    const $ = cheerio.load(html);
    const items = $(selectors.listing_item);
    if (items.length === 0) {
      ctx.log(
        `saas-pages: 0 items matched "${selectors.listing_item}" on ${url} — site markup may have drifted, check config/sources/saas-pages.yaml`
      );
      return;
    }
    const seen = new Set<string>();
    for (const el of items.toArray()) {
      const $el = $(el);
      const link = $el.find(selectors.listing_item_link).first().attr('href');
      if (!link || !link.startsWith('/sites/')) continue;
      const detailUrl = new URL(link, this.baseUrl).toString();
      const externalId = link.replace(/^\/sites\//, '').replace(/\/$/, '').toLowerCase();
      if (!externalId || seen.has(externalId)) continue;
      seen.add(externalId);
      const title = $el.find(selectors.listing_item_title).first().text().trim() || undefined;
      yield { externalId, originUrl: detailUrl, title };
    }
  },

  async signature(item: DiscoveredItem): Promise<string> {
    try {
      const html = await fetchHtml(item.originUrl);
      return contentHash(html);
    } catch {
      return contentHash(item.originUrl + (item.title ?? ''));
    }
  },

  async capture(item: DiscoveredItem, ctx: CrawlContext): Promise<RawCapture> {
    const limiter = new RateLimiter(ctx.rpm);
    await limiter.wait();
    return runCaptureRoutine({
      url: item.originUrl,
      externalId: item.externalId,
      title: item.title,
      creatorCredit: 'Versoly / SaaS Pages',
    });
  },

  async health(): Promise<HealthReport> {
    try {
      const url = new URL(listing.path, this.baseUrl).toString();
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const ok = $(selectors.listing_item).length > 0;
      return {
        ok,
        message: ok ? 'listing selector matched items' : `listing selector "${selectors.listing_item}" matched 0 items — site markup likely changed`,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { ok: false, message: (err as Error).message, checkedAt: new Date().toISOString() };
    }
  },
};
