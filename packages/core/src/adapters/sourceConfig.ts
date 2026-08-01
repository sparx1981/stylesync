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

export function loadSourceConfig(id: string): RawSourceConfig {
  const path = join(CONFIG_DIR, `${id}.yaml`);
  const doc = yaml.load(readFileSync(path, 'utf-8')) as RawSourceConfig;
  return doc;
}

export function loadAllSourceConfigs(): RawSourceConfig[] {
  return readdirSync(CONFIG_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => yaml.load(readFileSync(join(CONFIG_DIR, f), 'utf-8')) as RawSourceConfig);
}
