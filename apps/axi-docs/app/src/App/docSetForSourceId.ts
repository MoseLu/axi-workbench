import type { DocSetId } from '../config/siteConfig'

export function docSetForSourceId(sourceId?: string | null): DocSetId {
  if (typeof sourceId === 'string' && (sourceId === 'axi-skills' || sourceId === 'axi-skills-zh')) {
    return 'skills'
  }
  if (sourceId === 'workspace') return 'workspace'
  return 'guide'
}