/**
 * Skill family taxonomy + skill catalog/index builders.
 *
 * Barrel module: re-exports the same public surface that the monolithic
 * `skills.ts` used to expose so callers (and the `knowledgeBase.ts`
 * facade) keep working unchanged. Implementation is split into:
 *
 *   families.ts  — DB_SKILL_FAMILIES, AXI_SKILL_FAMILIES,
 *                  getSkillFamily, buildFallbackSkillFamily
 *                  (the `match` arrays are byte-exact and MUST NOT be
 *                   altered without coordinated test updates — see
 *                   arch-fix-6 lessons learned)
 *   subskills.ts — AXI_SKILL_SUBSECTIONS, buildSkillCatalogSubsections,
 *                  sortCatalogItems
 *   metadata.ts  — buildSkillIndexMarkdown, buildSkillCatalogSections
 *   lookup.ts    — buildSkillDocument, buildSkillAssetDocument,
 *                  collectSelectedSkillAssets, collectSkillSupportDocuments,
 *                  collectSkillDocuments
 *
 * No public API change: `knowledgeBase.ts` re-exports everything callers
 * used to import from the monolithic module.
 */

// taxonomy + matching
export {
  DB_SKILL_FAMILIES,
  AXI_SKILL_FAMILIES,
  getSkillFamily,
  buildFallbackSkillFamily,
} from './families'

// sub-section taxonomy + builder
export {
  AXI_SKILL_SUBSECTIONS,
  buildSkillCatalogSubsections,
  sortCatalogItems,
} from './subskills'

// catalog / index markdown builders
export {
  buildSkillIndexMarkdown,
  buildSkillCatalogSections,
} from './metadata'

// per-source file walker + virtual docs
export {
  buildSkillDocument,
  buildSkillAssetDocument,
  collectSkillDocuments,
  collectSelectedSkillAssets,
  collectSkillSupportDocuments,
} from './lookup'