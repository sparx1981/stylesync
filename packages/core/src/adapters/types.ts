export interface CrawlContext {
  dataDir: string;
  rpm: number;
  full: boolean;
  config: Record<string, unknown>;
  log: (msg: string) => void;
}

export interface DiscoveredItem {
  externalId: string;
  originUrl: string;
  title?: string;
  creatorCredit?: string;
  raw?: unknown;
}

export interface RawCapture {
  externalId: string;
  originUrl: string;
  title?: string;
  creatorCredit?: string;
  capturedAt: string;
  canonicalContent: string;
  screenshotPng?: Buffer;
  thumbPng?: Buffer;
  dom?: string;
  computedStyles?: Array<{ selector: string; styles: Record<string, string>; area: number }>;
  stylesheetText?: string;
  fontFaces?: string[];
  rootCustomProperties?: Record<string, string>;
  motionWebm?: Buffer;
  figmaNode?: unknown;
  status: 'ready' | 'partial' | 'failed';
  statusMessage?: string;
}

export interface HealthReport {
  ok: boolean;
  message: string;
  checkedAt: string;
}

export interface SourceAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly category: 'flows' | 'web' | 'vector' | 'motion';
  readonly accessMethod: 'api' | 'sitemap' | 'headless';
  readonly baseUrl: string;
  readonly rpm: number;

  discover(ctx: CrawlContext): AsyncIterable<DiscoveredItem>;
  signature(item: DiscoveredItem, ctx: CrawlContext): Promise<string>;
  capture(item: DiscoveredItem, ctx: CrawlContext): Promise<RawCapture>;
  health(ctx: CrawlContext): Promise<HealthReport>;
}

export class RateLimiter {
  private lastRun = 0;
  constructor(private rpm: number) {}
  async wait(): Promise<void> {
    const minIntervalMs = 60_000 / this.rpm;
    const elapsed = Date.now() - this.lastRun;
    const remaining = minIntervalMs - elapsed;
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    this.lastRun = Date.now();
  }
}
