import type { RawCapture } from '../adapters/types.js';
import type { DRP } from './types.js';
import { extractTierB } from './extractTierB.js';
import { extractTierA } from './extractTierA.js';

export function buildDRP(refId: string, sourceId: string, capture: RawCapture): DRP {
  if (capture.figmaNode) {
    return extractTierA(capture, refId);
  }
  if (capture.computedStyles && capture.computedStyles.length > 0) {
    return extractTierB(capture, refId, sourceId);
  }
  throw new Error(
    `No computed styles or Figma data in capture for ${refId} — cannot extract a DRP without either Tier A or Tier B input. ` +
      `(Tier C vision extraction for screenshot-only captures is not wired up yet — see extractTierC.ts.)`
  );
}
