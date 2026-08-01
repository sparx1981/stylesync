import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '..', '..', 'config', 'sources');

export interface RawSourceConfig {
    id: string;
    display_name: string;
    category: 'flows' | 'web' | 'vector' | 'motion';
    access_method: 'api' | 'sitemap' | 'headless';
    base_url: string;
    rpm: number;
    enabled: boolean;
    [key: string]: unknown;
}

// Fallback used when config/sources/*.yaml isn't reachable on disk — e.g. a
// Vercel deployment, where Next's output file tracing doesn't reliably
// follow readdirSync/readFileSync calls into @stylesync/core's non-JS
// assets across the pnpm workspace symlink (the same issue that hit the
// Postgres schema file). Kept in sync with the three YAML files by hand;
// the CLI and local `pnpm web dev` still read the real files directly, so
// this only matters for the hosted deployment.
const BUNDLED_SOURCE_CONFIGS: RawSourceConfig[] = [
  {
        id: 'figma',
        display_name: 'Figma Community',
        category: 'web',
        access_method: 'api',
        base_url: 'https://api.figma.com',
        rpm: 30,
        enabled: true,
        tracked_files: [],
  },
  {
        id: 'lapa-ninja',
        display_name: 'Lapa Ninja',
        category: 'web',
        access_method: 'sitemap',
        base_url: 'https://www.lapa.ninja',
        rpm: 6,
        enabled: true,
        listing: {
                path_template: '/page/{page}/',
                start_page: 1,
                page_count: 5,
        },
        selectors: {
                listing_item: 'article.item, div.grid-item, .post-item',
                listing_item_link: 'a',
                listing_item_title: 'h2, h3, .entry-title',
                detail_visit_link: "a.visit, a[href*='out']:not([href*='lapa.ninja']), a:contains('Visit Website')",
        },
        follow_through_to_live_site: true,
  },
  {
        id: 'url',
        display_name: 'Ad-hoc URL',
        category: 'web',
        access_method: 'headless',
        base_url: '',
        rpm: 6,
        enabled: true,
  },
  ];

export function loadSourceConfig(id: string): RawSourceConfig {
    try {
          const path = join(CONFIG_DIR, `${id}.yaml`);
          return yaml.load(readFileSync(path, 'utf-8')) as RawSourceConfig;
    } catch {
          const fallback = BUNDLED_SOURCE_CONFIGS.find((c) => c.id === id);
          if (!fallback) throw new Error(`unknown source config: ${id}`);
          return fallback;
    }
}

export function loadAllSourceConfigs(): RawSourceConfig[] {
    try {
          return readdirSync(CONFIG_DIR)
            .filter((f) => f.endsWith('.yaml'))
            .map((f) => yaml.load(readFileSync(join(CONFIG_DIR, f), 'utf-8')) as RawSourceConfig);
    } catch {
          return BUNDLED_SOURCE_CONFIGS;
    }
}
