import type { RawCapture } from '../adapters/types.js';
import type { DRP } from './types.js';
import { extractTierB } from './extractTierB.js';
import { extractTierA } from './extractTierA.js';
import { extractTierC } from './extractTierC.js';

export async function buildDRP(refId: string, sourceId: string, capture: RawCapture): Promise<DRP> {
  if (capture.figmaNode) {
    return extractTierA(capture, refId);
  }
  if (capture.computedStyles && capture.computedStyles.length > 0) {
    return extractTierB(capture, refId, sourceId);
  }
  if (capture.screenshotPng) {
    return extractTierC(capture, refId, sourceId);
  }
  throw new Error(
    `No computed styles, Figma data, or screenshot in capture for ${refId} — cannot extract a DRP from any tier.`
  );
}
