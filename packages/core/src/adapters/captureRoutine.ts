import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalise, contentHash, visualHashPlaceholder } from '../util/hash.js';
import type { RawCapture } from './types.js';

export interface CaptureOptions {
  url: string;
  externalId: string;
  title?: string;
  creatorCredit?: string;
  captureMobile?: boolean;
  captureMotion?: boolean;
  browser?: Browser;
}

const SELECTOR_HEURISTICS = [
  'button', '[role="button"]', 'a.btn', 'a[class*="button"]',
  'input', 'textarea', 'select',
  '[class*="card"]', '[class*="Card"]',
  'h1', 'h2', 'h3', 'h4', 'nav', 'table', 'thead', 'tbody th', 'tbody td',
];

export async function runCaptureRoutine(opts: CaptureOptions): Promise<RawCapture> {
  const ownBrowser = !opts.browser;
  const browser = opts.browser ?? (await chromium.launch({ headless: true }));
  const capturedAt = new Date().toISOString();

  // Video recording has to be configured at context-creation time in
  // Playwright, and the file is only flushed to disk once the context is
  // closed — so a temp dir is set up up front whenever motion capture is
  // requested, and read back after `context.close()` below.
  let videoDir: string | undefined;
  if (opts.captureMotion) {
    videoDir = mkdtempSync(join(tmpdir(), 'stylesync-motion-'));
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) StyleSyncBot/2.0 (personal, low-rate, contact: local-user)',
      ...(videoDir ? { recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } } } : {}),
    });

    await context.route('**/*', (route) => {
      const url = route.request().url();
      const blocked = /doubleclick|googletagmanager|google-analytics|facebook\.net|hotjar|segment\.io|intercom|mixpanel/i;
      if (blocked.test(url)) return route.abort();
      return route.continue();
    });

    const page = await context.newPage();

    let status: RawCapture['status'] = 'ready';
    let statusMessage: string | undefined;

    try {
      await page.goto(opts.url, { waitUntil: 'networkidle', timeout: 30_000 });
    } catch (err) {
      status = 'partial';
      statusMessage = `navigation issue: ${(err as Error).message}`;
    }

    try {
      await page.waitForFunction(() => (document as any).fonts?.status === 'loaded', { timeout: 5000 });
    } catch {
      // Non-fatal — degrade, don't fail.
    }
    await page.waitForTimeout(500);

    const screenshotPng = await page
      .screenshot({ type: 'png', fullPage: true })
      .catch((err) => {
        status = 'partial';
        statusMessage = `screenshot failed: ${(err as Error).message}`;
        return undefined;
      });

    const thumbPng = await page
      .screenshot({ type: 'png', fullPage: false })
      .catch(() => undefined);

    const dom = await page.content().catch(() => undefined);

    const { computedStyles, stylesheetText, fontFaces, rootCustomProperties } = await extractStyles(page).catch(
      (err) => {
        status = status === 'ready' ? 'partial' : status;
        statusMessage = statusMessage ?? `style extraction failed: ${(err as Error).message}`;
        return { computedStyles: [], stylesheetText: '', fontFaces: [], rootCustomProperties: {} };
      }
    );

    const canonicalContent = canonicalise({ dom, computedStyles, stylesheetText });

    if (opts.captureMotion) {
      await recordMotion(page).catch((err) => {
        statusMessage = statusMessage ?? `motion capture interaction failed: ${(err as Error).message}`;
      });
    }

    // The video file is only flushed to disk once the context closes, so it
    // has to be read back afterwards rather than during the interaction.
    const video = opts.captureMotion ? page.video() : undefined;
    await context.close();

    let motionWebm: Buffer | undefined;
    if (video) {
      try {
        const path = await video.path();
        motionWebm = readFileSync(path);
      } catch (err) {
        statusMessage = statusMessage ?? `motion video unavailable: ${(err as Error).message}`;
      }
    }

    return {
      externalId: opts.externalId,
      originUrl: opts.url,
      title: opts.title,
      creatorCredit: opts.creatorCredit,
      capturedAt,
      canonicalContent,
      screenshotPng,
      thumbPng,
      dom,
      computedStyles,
      stylesheetText,
      fontFaces,
      rootCustomProperties,
      motionWebm,
      status,
      statusMessage,
    };
  } finally {
    if (ownBrowser) await browser.close();
    if (videoDir) rmSync(videoDir, { recursive: true, force: true });
  }
}

/**
 * Drives a short, generic interaction sequence — hover the most prominent
 * interactive element, then scroll — so the context's video recording
 * captures whatever hover/scroll-triggered micro-interactions the page has
 * (the reason a source like Godly, built around motion, needs this instead
 * of a static screenshot). Returns nothing directly; the actual video bytes
 * are read from `page.video()` by the caller once the context is closed.
 */
async function recordMotion(page: Page): Promise<undefined> {
  try {
    const hoverTarget = page.locator(SELECTOR_HEURISTICS.join(', ')).first();
    if (await hoverTarget.count()) {
      await hoverTarget.hover({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(600);
    }
  } catch {
    // Non-fatal — a hover target may not exist; the scroll below still runs.
  }
  await page.mouse.wheel(0, 800).catch(() => undefined);
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, -400).catch(() => undefined);
  await page.waitForTimeout(500);
  return undefined;
}

async function extractStyles(page: Page) {
  return page.evaluate((heuristics: string[]) => {
    const seen = new Set<string>();
    const results: Array<{ selector: string; styles: Record<string, string>; area: number }> = [];
    const PROPS = [
      'color', 'background-color', 'border-color', 'border-radius', 'box-shadow',
      'font-size', 'font-weight', 'line-height', 'letter-spacing', 'font-family',
      'padding', 'margin', 'gap', 'transition-duration', 'transition-timing-function',
    ];

    function sample(el: Element, label: string) {
      if (results.length >= 1500) return;
      const cs = window.getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const p of PROPS) styles[p] = cs.getPropertyValue(p);
      const rect = el.getBoundingClientRect();
      const area = Math.max(0, rect.width) * Math.max(0, rect.height);
      results.push({ selector: label, styles, area });
    }

    const all = Array.from(document.querySelectorAll('body *'));
    for (const el of all) {
      const sig = el.tagName.toLowerCase() + '.' + Array.from(el.classList).sort().join('.');
      if (seen.has(sig)) continue;
      seen.add(sig);
      sample(el, sig);
      if (results.length >= 1500) break;
    }

    for (const heuristic of heuristics) {
      document.querySelectorAll(heuristic).forEach((el, i) => {
        sample(el, `${heuristic}#${i}`);
      });
    }

    const stylesheetText = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules)
            .map((r) => r.cssText)
            .join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');

    const fontFaces: string[] = [];
    document.fonts.forEach((f) => {
      fontFaces.push(`${f.family} ${f.weight} ${f.style}`);
    });

    const rootStyles = window.getComputedStyle(document.documentElement);
    const rootCustomProperties: Record<string, string> = {};
    for (let i = 0; i < rootStyles.length; i++) {
      const prop = rootStyles[i];
      if (prop.startsWith('--')) {
        rootCustomProperties[prop] = rootStyles.getPropertyValue(prop).trim();
      }
    }

    return { computedStyles: results, stylesheetText, fontFaces, rootCustomProperties };
  }, SELECTOR_HEURISTICS);
}
