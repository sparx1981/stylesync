import { chromium } from 'playwright';
import { loadSourceConfig } from './sourceConfig.js';
import { contentHash } from '../util/hash.js';
import type { CrawlContext, DiscoveredItem, HealthReport, RawCapture, SourceAdapter } from './types.js';
import { RateLimiter } from './types.js';

const cfg = loadSourceConfig('banani');
const listing = cfg.listing as { app_slugs: string[]; screens_per_app_limit: number; scroll_passes: number };

const UA = 'Mozilla/5.0 (compatible; StyleSyncBot/2.0; +personal, low-rate, single-user tool)';

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Banani's app reference pages (banani.co/references/apps/{slug}) render
 * individual screenshots as lazy-loaded <img> tags — a plain fetch only
 * sees a fraction of them (confirmed: 17 in raw HTML vs ~59 after the page
 * finishes loading), so discovery has to run through a real browser and
 * scroll the page, the same way capture() would for a normal site. Each
 * screenshot is itself the whole "reference" (there's no separate live
 * page per screen), so capture() just downloads that image directly rather
 * than running the full Playwright capture routine — it becomes a Tier C
 * (vision-inferred) DRP since there's no DOM/computed CSS for a bare image.
 */
export const bananiAdapter: SourceAdapter = {
  id: 'banani',
  displayName: 'Banani',
  category: 'flows',
  accessMethod: 'headless',
  baseUrl: 'https://www.banani.co',
  rpm: cfg.rpm,

  async *discover(ctx: CrawlContext): AsyncIterable<DiscoveredItem> {
    const limiter = new RateLimiter(ctx.rpm);
    const browser = await chromium.launch({ headless: true });
    try {
      for (const slug of listing.app_slugs) {
        await limiter.wait();
        const pageUrl = new URL(`/references/apps/${slug}`, this.baseUrl).toString();
        const page = await browser.newPage({ userAgent: UA });
        try {
          await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30_000 });
          for (let i = 0; i < listing.scroll_passes; i++) {
            await page.mouse.wheel(0, 1400);
            await page.waitForTimeout(250);
          }

          const screens = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            const seen = new Set<string>();
            const out: Array<{ src: string; alt: string }> = [];
            for (const img of imgs) {
              const rect = img.getBoundingClientRect();
              if (rect.width < 100 || rect.height < 150) continue; // skip logo/icons
              const src = img.currentSrc || img.src;
              if (!src || seen.has(src)) continue;
              seen.add(src);
              out.push({ src, alt: img.alt || '' });
            }
            return out;
          });

          for (const screen of screens.slice(0, listing.screens_per_app_limit)) {
            const externalId = `${slug}-${contentHash(screen.src).slice(0, 12)}`;
            yield {
              externalId,
              originUrl: pageUrl,
              title: screen.alt || `${slug} screen`,
              creatorCredit: slug,
              raw: { imageUrl: screen.src },
            };
          }
        } catch (err) {
          ctx.log(`banani: ${slug} page failed: ${(err as Error).message}`);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  },

  async signature(item: DiscoveredItem): Promise<string> {
    const imageUrl = (item.raw as { imageUrl?: string } | undefined)?.imageUrl;
    return contentHash(imageUrl ?? item.originUrl);
  },

  async capture(item: DiscoveredItem): Promise<RawCapture> {
    const imageUrl = (item.raw as { imageUrl?: string } | undefined)?.imageUrl;
    const capturedAt = new Date().toISOString();
    if (!imageUrl) {
      return {
        externalId: item.externalId,
        originUrl: item.originUrl,
        title: item.title,
        creatorCredit: item.creatorCredit,
        capturedAt,
        canonicalContent: item.originUrl,
        status: 'failed',
        statusMessage: 'no image URL recorded during discovery',
      };
    }
    try {
      const screenshotPng = await fetchBuffer(imageUrl);
      return {
        externalId: item.externalId,
        originUrl: item.originUrl,
        title: item.title,
        creatorCredit: item.creatorCredit,
        capturedAt,
        canonicalContent: imageUrl,
        screenshotPng,
        thumbPng: screenshotPng,
        status: 'ready',
      };
    } catch (err) {
      return {
        externalId: item.externalId,
        originUrl: item.originUrl,
        title: item.title,
        creatorCredit: item.creatorCredit,
        capturedAt,
        canonicalContent: imageUrl,
        status: 'failed',
        statusMessage: `image download failed: ${(err as Error).message}`,
      };
    }
  },

  async health(): Promise<HealthReport> {
    try {
      const url = new URL(`/references/apps/${listing.app_slugs[0]}`, this.baseUrl).toString();
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      return {
        ok: res.ok,
        message: res.ok ? 'reference app page reachable' : `GET ${url} -> ${res.status}`,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { ok: false, message: (err as Error).message, checkedAt: new Date().toISOString() };
    }
  },
};
