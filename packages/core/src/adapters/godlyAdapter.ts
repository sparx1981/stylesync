import { chromium, type Browser } from 'playwright';
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

// Only the "Websites" category listing on recent.design links each card out
// to the actual live site being showcased (a "View post" href sitting next
// to the internal /i/{slug} link) — App Screenshots cards link to an App
// Store listing instead (Apple's own styling, nothing to do with the app's
// real UI), and App Icons/OG Images have no browsable target at all. So
// real-site capture is only ever attempted for items that turn up in this
// map; everything else keeps the existing vision-only path completely
// unchanged. Built once per sync run (memoised) from a single crawl of
// recent.design/websites, keyed by the item's /i/ slug for an O(1) lookup
// per item in capture().
let websiteRealUrlMap: Promise<Map<string, string>> | null = null;

async function getWebsiteRealUrlMap(browser: Browser, log: (msg: string) => void): Promise<Map<string, string>> {
  if (!websiteRealUrlMap) {
    websiteRealUrlMap = (async () => {
      const map = new Map<string, string>();
      try {
        const page = await browser.newPage();
        try {
          await page.goto('https://recent.design/websites', { waitUntil: 'networkidle', timeout: 30_000 });
          const pairs = await page.evaluate(() => {
            const blocked = /recent\.design|apps\.apple\.com|play\.google\.com|twitter\.com|x\.com/i;
            const out: Array<{ slug: string; url: string }> = [];
            const itemLinks = Array.from(document.querySelectorAll('a[href^="/i/"]')) as HTMLAnchorElement[];
            for (const a of itemLinks) {
              const slug = a.getAttribute('href')!.replace('/i/', '').replace(/\/$/, '');
              let node: HTMLElement | null = a;
              let found: string | null = null;
              for (let depth = 0; depth < 6 && node; depth++) {
                node = node.parentElement;
                if (!node) break;
                const ext = node.querySelector('a[href^="http"]') as HTMLAnchorElement | null;
                if (ext && !blocked.test(ext.href)) {
                  found = ext.href;
                  break;
                }
              }
              if (found) out.push({ slug, url: found });
            }
            return out;
          });
          for (const { slug, url } of pairs) map.set(slug, url);
        } finally {
          await page.close();
        }
      } catch (err) {
        log(`godly: could not crawl recent.design/websites for real site links: ${(err as Error).message}`);
      }
      return map;
    })();
  }
  return websiteRealUrlMap;
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
    const browser = await chromium.launch({ headless: true });
    try {
      // captureMotion: true — the reason this source exists at all is
      // motion/micro-interaction reference; the animated media on these pages
      // (often an animated .webp) plays in real time, so a short screen
      // recording captures it the same way it would a video element.
      const capture = await runCaptureRoutine({
        url: item.originUrl,
        externalId: item.externalId,
        title: item.title,
        creatorCredit: 'via Recent (recent.design)',
        captureMotion: true,
        browser,
      });

      // This page's own DOM (nav, buttons, headings) belongs to
      // recent.design's site chrome, not the individual shot being
      // referenced, so it's never used for styling directly. If this item
      // is in the "Websites" category we can instead pull real computed CSS
      // from the actual live site; everything else falls back to vision
      // extraction of the showcased screenshot/motion, same as before.
      const realUrlMap = await getWebsiteRealUrlMap(browser, ctx.log);
      const realUrl = realUrlMap.get(item.externalId);
      if (!realUrl) {
        return { ...capture, computedStyles: undefined };
      }

      try {
        const realCapture = await runCaptureRoutine({
          url: realUrl,
          externalId: `${item.externalId}-realsite`,
          captureMotion: false,
          browser,
        });
        return {
          ...capture,
          computedStyles: realCapture.computedStyles,
          stylesheetText: realCapture.stylesheetText,
          fontFaces: realCapture.fontFaces,
          rootCustomProperties: realCapture.rootCustomProperties,
        };
      } catch (err) {
        ctx.log(`godly: real-site capture failed for ${realUrl}, falling back to vision: ${(err as Error).message}`);
        return { ...capture, computedStyles: undefined };
      }
    } finally {
      await browser.close();
    }
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
