import { chromium, type Browser } from 'playwright';
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

// Every /spells/{slug} page tags the app being showcased (e.g. "Transit"),
// linking to designspells.com/apps/{app-slug} — and THAT page links out to
// the app's real, live website (confirmed live: /apps/transit -> https://
// transitapp.com, /apps/discord -> https://discord.gg). Resolving this
// two-hop chain lets capture() pull real computed CSS (real fonts, real
// colours, real component recipes) from the actual product instead of
// guessing from a screenshot — Tier B instead of Tier C. Cached per
// app-slug since many spells share the same app (e.g. five different
// Discord interactions all resolve to the same discord.gg lookup).
const appRealUrlCache = new Map<string, string | null>();

async function resolveRealSiteUrl(browser: Browser, spellUrl: string, log: (msg: string) => void): Promise<string | null> {
  let appSlug: string | null = null;
  try {
    const page = await browser.newPage();
    try {
      await page.goto(spellUrl, { waitUntil: 'networkidle', timeout: 20_000 });
      appSlug = await page.evaluate(() => {
        const link = document.querySelector('a[href^="/apps/"]');
        const href = link?.getAttribute('href');
        return href ? href.replace('/apps/', '').replace(/\/$/, '') : null;
      });
    } finally {
      await page.close();
    }
  } catch (err) {
    log(`design-spells: could not read app link from ${spellUrl}: ${(err as Error).message}`);
    return null;
  }
  if (!appSlug) return null;

  if (appRealUrlCache.has(appSlug)) return appRealUrlCache.get(appSlug)!;

  let realUrl: string | null = null;
  try {
    const page = await browser.newPage();
    try {
      await page.goto(`https://designspells.com/apps/${appSlug}`, { waitUntil: 'networkidle', timeout: 20_000 });
      realUrl = await page.evaluate(() => {
        // Skip designspells.com's own nav/sponsor/social links -- the real
        // app link is the first outbound href that isn't one of those.
        const blocked = /designspells\.com|twitter\.com|x\.com|threads\.net|mastodon\.social|tally\.so/i;
        const anchors = Array.from(document.querySelectorAll('a[href^="http"]')) as HTMLAnchorElement[];
        for (const a of anchors) {
          if (!blocked.test(a.href)) return a.href;
        }
        return null;
      });
    } finally {
      await page.close();
    }
  } catch (err) {
    log(`design-spells: could not resolve real site for app "${appSlug}": ${(err as Error).message}`);
  }
  appRealUrlCache.set(appSlug, realUrl);
  return realUrl;
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
    const browser = await chromium.launch({ headless: true });
    try {
      // captureMotion: true — every spell page centres on a real captured
      // video of the interaction, so a short screen recording (same
      // mechanism used for Godly/Recent) preserves that rather than a static
      // screenshot of one frame.
      const capture = await runCaptureRoutine({
        url: item.originUrl,
        externalId: item.externalId,
        title: item.title,
        creatorCredit: 'via Design Spells',
        captureMotion: true,
        browser,
      });

      // This page's own DOM (nav, "Submit"/"Subscribe" buttons, tag pills)
      // belongs to designspells.com's site chrome, not the interaction being
      // referenced, so it's never used for styling — either real computed
      // CSS pulled from the actual product below, or (if that can't be
      // resolved) vision extraction of the showcased screenshot, same as
      // before this real-site lookup existed.
      const realUrl = await resolveRealSiteUrl(browser, item.originUrl, ctx.log);
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
        ctx.log(`design-spells: real-site capture failed for ${realUrl}, falling back to vision: ${(err as Error).message}`);
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
