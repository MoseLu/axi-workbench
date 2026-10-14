import type { SearchSuggestion } from '../../types'
import { FileIcon, TagIcon } from '../Icons'

export function SuggestionIcon({ kind }: Pick<SearchSuggestion, 'kind'>) {
  if (kind === 'tag') return <TagIcon />
  return <FileIcon />
}