/**
 * Skill family taxonomy + skill catalog/index builders.
 *
 * Backward-compatible shim. The implementation has been split into the
 * `skills/` sub-directory (families / subskills / metadata / lookup). All
 * public symbols are re-exported from `./skills` so callers importing from
 * this path keep working unchanged.
 */

export type {
  ParsedDocument,
  SkillFamilyDefinition,
  SkillSubsectionDefinition,
} from './types'

export * from './skills/index'