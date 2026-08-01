import { loadSourceConfig } from './sourceConfig.js';
import { contentHash } from '../util/hash.js';
import type { CrawlContext, DiscoveredItem, HealthReport, RawCapture, SourceAdapter } from './types.js';

const cfg = loadSourceConfig('figma');

interface FigmaFilesConfig {
  tracked_files: string[];
}

export const figmaAdapter: SourceAdapter = {
  id: 'figma',
  displayName: 'Figma Community',
  category: 'web',
  accessMethod: 'api',
  baseUrl: 'https://api.figma.com',
  rpm: cfg.rpm,

  async *discover(ctx: CrawlContext): AsyncIterable<DiscoveredItem> {
    const trackedFiles = ((cfg as unknown as FigmaFilesConfig).tracked_files ?? []) as string[];
    if (trackedFiles.length === 0) {
      ctx.log('figma: no tracked_files configured in config/sources/figma.yaml — nothing to sync');
      return;
    }
    const token = process.env.FIGMA_TOKEN;
    if (!token) {
      ctx.log('figma: FIGMA_TOKEN not set — skipping. Export a personal access token from https://www.figma.com/developers/api#access-tokens');
      return;
    }
    for (const fileKey of trackedFiles) {
      const res = await fetch(`${this.baseUrl}/v1/files/${fileKey}?depth=1`, {
        headers: { 'X-Figma-Token': token },
      });
      if (!res.ok) {
        ctx.log(`figma: file ${fileKey} -> HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { name: string; lastModified: string };
      yield {
        externalId: fileKey,
        originUrl: `https://www.figma.com/file/${fileKey}`,
        title: json.name,
        raw: { fileKey, lastModified: json.lastModified },
      };
    }
  },

  async signature(item: DiscoveredItem): Promise<string> {
    const raw = item.raw as { lastModified?: string };
    return contentHash(raw?.lastModified ?? item.externalId);
  },

  async capture(item: DiscoveredItem, ctx: CrawlContext): Promise<RawCapture> {
    const token = process.env.FIGMA_TOKEN;
    const fileKey = (item.raw as { fileKey: string }).fileKey;
    const capturedAt = new Date().toISOString();

    if (!token) {
      return {
        externalId: item.externalId,
        originUrl: item.originUrl,
        title: item.title,
        capturedAt,
        canonicalContent: '',
        status: 'failed',
        statusMessage: 'FIGMA_TOKEN not set',
      };
    }

    const [varsRes, stylesRes] = await Promise.all([
      fetch(`${this.baseUrl}/v1/files/${fileKey}/variables/local`, { headers: { 'X-Figma-Token': token } }),
      fetch(`${this.baseUrl}/v1/files/${fileKey}/styles`, { headers: { 'X-Figma-Token': token } }),
    ]);

    let status: RawCapture['status'] = 'ready';
    let statusMessage: string | undefined;
    let figmaNode: unknown = {};

    if (varsRes.ok) {
      figmaNode = { variables: await varsRes.json() };
    } else {
      status = 'partial';
      statusMessage = `variables API returned ${varsRes.status} (needs an Enterprise seat on some plans) — falling back to styles`;
    }
    if (stylesRes.ok) {
      figmaNode = { ...(figmaNode as object), styles: await stylesRes.json() };
    }

    const canonicalContent = JSON.stringify(figmaNode);

    return { externalId: item.externalId, originUrl: item.originUrl, title: item.title, capturedAt, canonicalContent, figmaNode, status, statusMessage };
  },

  async health(ctx: CrawlContext): Promise<HealthReport> {
    const token = process.env.FIGMA_TOKEN;
    if (!token) {
      return { ok: false, message: 'FIGMA_TOKEN not set', checkedAt: new Date().toISOString() };
    }
    const res = await fetch(`${this.baseUrl}/v1/me`, { headers: { 'X-Figma-Token': token } });
    return { ok: res.ok, message: res.ok ? 'token valid' : `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
  },
};
