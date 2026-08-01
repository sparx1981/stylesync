import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
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

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) StyleSyncBot/2.0 (personal, low-rate, contact: local-user)',
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

    await context.close();

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
      status,
      statusMessage,
    };
  } finally {
    if (ownBrowser) await browser.close();
  }
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
