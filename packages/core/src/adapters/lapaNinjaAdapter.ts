import * as cheerio from 'cheerio';
import { runCaptureRoutine } from './captureRoutine.js';
import { loadSourceConfig } from './sourceConfig.js';
import { contentHash } from '../util/hash.js';
import type { CrawlContext, DiscoveredItem, HealthReport, RawCapture, SourceAdapter } from './types.js';
import { RateLimiter } from './types.js';

const cfg = loadSourceConfig('lapa-ninja');
const selectors = cfg.selectors as Record<string, string>;
const listing = cfg.listing as { path_template: string; start_page: number; page_count: number };

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; StyleSyncBot/2.0; +personal, low-rate, single-user tool)',
    },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

export const lapaNinjaAdapter: SourceAdapter = {
  id: 'lapa-ninja',
  displayName: 'Lapa Ninja',
  category: 'web',
  accessMethod: 'sitemap',
  baseUrl: 'https://www.lapa.ninja',
  rpm: cfg.rpm,

  async *discover(ctx: CrawlContext): AsyncIterable<DiscoveredItem> {
    const limiter = new RateLimiter(ctx.rpm);
    for (let page = listing.start_page; page < listing.start_page + listing.page_count; page++) {
      await limiter.wait();
      const url = new URL(listing.path_template.replace('{page}', String(page)), this.baseUrl).toString();
      let html: string;
      try {
        html = await fetchHtml(url);
      } catch (err) {
        ctx.log(`lapa-ninja: listing page ${page} failed: ${(err as Error).message}`);
        continue;
      }
      const $ = cheerio.load(html);
      const items = $(selectors.listing_item);
      if (items.length === 0) {
        ctx.log(
          `lapa-ninja: 0 items matched "${selectors.listing_item}" on ${url} — site markup may have drifted, check config/sources/lapa-ninja.yaml`
        );
        continue;
      }
      for (const el of items.toArray()) {
        const $el = $(el);
        const link = $el.find(selectors.listing_item_link).first().attr('href');
        if (!link) continue;
        const detailUrl = new URL(link, this.baseUrl).toString();
        const title = $el.find(selectors.listing_item_title).first().text().trim() || undefined;
        const externalId = slugFromUrl(detailUrl);
        yield { externalId, originUrl: detailUrl, title, raw: { detailUrl } };
      }
    }
  },

  async signature(item: DiscoveredItem, ctx: CrawlContext): Promise<string> {
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

    let liveUrl = item.originUrl;
    let creatorCredit: string | undefined;
    try {
      const detailHtml = await fetchHtml(item.originUrl);
      const $ = cheerio.load(detailHtml);
      const visitHref = $(selectors.detail_visit_link).first().attr('href');
      if (visitHref) liveUrl = visitHref;
      creatorCredit = $('meta[name="author"]').attr('content') ?? undefined;
    } catch (err) {
      ctx.log(`lapa-ninja: could not resolve live-site link for ${item.originUrl}, capturing detail page instead: ${(err as Error).message}`);
    }

    return runCaptureRoutine({
      url: liveUrl,
      externalId: item.externalId,
      title: item.title,
      creatorCredit,
    });
  },

  async health(ctx: CrawlContext): Promise<HealthReport> {
    try {
      const html = await fetchHtml(this.baseUrl + '/');
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

function slugFromUrl(url: string): string {
  const path = new URL(url).pathname.replace(/\/$/, '');
  const last = path.split('/').filter(Boolean).pop() ?? path;
  return last.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 64);
}
