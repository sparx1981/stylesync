// Public API surface of @stylesync/core — consumed by @stylesync/cli and apps/web.

export { StyleSyncDB, resolveDataDir } from './db/db.js';
export { StyleSyncPostgresDB } from './db/postgresDb.js';
export { getDb } from './db/getDb.js';
export type { Db } from './db/getDb.js';
export type { SourceRow, RefRow, RefAssetRow, DrpRow, PackRow, SyncRunRow } from './db/db.js';

export { syncSource } from './sync.js';
export type { SyncOptions, SyncStats } from './sync.js';

export { ADAPTERS, getAdapter, listAdapters } from './adapters/registry.js';
export type { SourceAdapter, CrawlContext, DiscoveredItem, RawCapture, HealthReport } from './adapters/types.js';
export { loadSourceConfig, loadAllSourceConfigs } from './adapters/sourceConfig.js';

export type { DRP, ComponentRole, ComponentRecipe } from './drp/types.js';
export { COMPONENT_ROLES } from './drp/types.js';
export { buildDRP } from './drp/extract.js';
export { extractTierA } from './drp/extractTierA.js';
export { extractTierB } from './drp/extractTierB.js';
export { extractTierC } from './drp/extractTierC.js';
export { validateQualityGate } from './drp/qualityGate.js';
export type { QualityGateResult } from './drp/qualityGate.js';

export { renderBrandGuidePdf } from './brandguide/renderBrandGuidePdf.js';
export type { BrandGuideOptions } from './brandguide/renderBrandGuidePdf.js';

export { generatePack } from './pack/generatePack.js';
export type { GeneratePackOptions, GeneratePackResult } from './pack/generatePack.js';
export { renderStylepackMd } from './pack/stylepackMd.js';
export { renderTokensCss } from './pack/tokensCss.js';
export { renderTailwindTheme } from './pack/tailwindTheme.js';
export { renderTokensJson } from './pack/tokensJson.js';
export { renderComponentsMd } from './pack/componentsMd.js';

export { applyDeterministic, assertCleanTree, revertViaGit } from './codemods/apply.js';
export type { ApplyOptions, ApplyResult, IntensityLevel, TransformCategory } from './codemods/apply.js';
export { runVerification, takeShots, runAxeCheck } from './codemods/verify.js';
export type { VerificationResult } from './codemods/verify.js';
export { MutationGuardViolation, MutationLog, assertAllowed } from './codemods/mutationGuard.js';
export type { MutationTarget, MutationKind } from './codemods/mutationGuard.js';
export { nearestToken } from './codemods/colorMap.js';
