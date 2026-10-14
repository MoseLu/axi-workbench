import { createPortal } from 'react-dom'
import type { SearchSuggestion } from '../../types'
import { SearchIcon } from '../Icons'
import { SuggestionIcon } from './SuggestionIcon'

interface SearchModalProps {
  open: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  inputValue: string
  onInputChange: (value: string) => void
  trimmedInput: string
  suggestions: SearchSuggestion[]
  documentSuggestions: SearchSuggestion[]
  tagSuggestions: SearchSuggestion[]
  suggestionsPending: boolean
  activeIndex: number
  currentLocale: 'zh' | 'en'
  uiCopy: {
    searchInputLabel: string
    searchPlaceholder: string
    clearSearch: string
    searchAllPrefix: string
    searchAllMeta: string
    documentGroup: string
    tagGroup: string
    navigationKeys: string
    selectKey: string
    closeKey: string
    poweredBy: string
  }
  renderSuggestion: (suggestion: SearchSuggestion, index: number) => React.ReactNode
  pickSuggestion: (suggestion: SearchSuggestion) => void
  submitSearch: (value: string) => void
  closeSearch: () => void
  clearSearch: () => void
  setActiveIndex: (updater: (current: number) => number) => void
}

export function SearchModal({
  open,
  inputRef,
  inputValue,
  onInputChange,
  trimmedInput,
  suggestions,
  documentSuggestions,
  tagSuggestions,
  suggestionsPending,
  activeIndex,
  currentLocale,
  uiCopy,
  renderSuggestion,
  pickSuggestion,
  submitSearch,
  closeSearch,
  clearSearch,
  setActiveIndex,
}: SearchModalProps) {
  if (!open) return null
  return createPortal(
    <div
      aria-modal="true"
      className="header-search-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSearch()
      }}
      role="dialog"
    >
      <div className={`header-search-modal__panel${trimmedInput ? ' header-search-modal__panel--with-results' : ''}`}>
        <div className="header-search-modal__field">
          <SearchIcon />
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            id="header-search-input"
            aria-autocomplete="list"
            aria-controls="header-search-suggestions"
            aria-expanded={suggestions.length > 0}
            aria-label={uiCopy.searchInputLabel}
            className="header-search-input"
            placeholder={uiCopy.searchPlaceholder}
            type="text"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && suggestions.length > 0) {
                event.preventDefault()
                setActiveIndex((current) => {
                  const next = current < 0 ? 0 : current + 1
                  return next >= suggestions.length ? 0 : next
                })
              }

              if (event.key === 'ArrowUp' && suggestions.length > 0) {
                event.preventDefault()
                setActiveIndex((current) => {
                  if (current <= 0) return suggestions.length - 1
                  return current - 1
                })
              }

              if (event.key === 'Enter') {
                event.preventDefault()
                if (activeIndex >= 0 && suggestions[activeIndex]) {
                  pickSuggestion(suggestions[activeIndex])
                  return
                }
                submitSearch(inputValue)
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                closeSearch()
              }
            }}
          />
          {inputValue && (
            <button
              aria-label={uiCopy.clearSearch}
              className="search-clear-btn"
              onClick={clearSearch}
              type="button"
            >
              ×
            </button>
          )}
        </div>

        {trimmedInput && (
          <div className="header-search__panel" id="header-search-suggestions" role="listbox">
            <button
              aria-selected={activeIndex === -1}
              className="header-search__suggestion header-search__suggestion--submit"
              onMouseDown={(event) => {
                event.preventDefault()
                submitSearch(inputValue)
              }}
              role="option"
              type="button"
            >
              <span className="header-search__suggestion-icon">
                <SearchIcon />
              </span>
              <span className="header-search__suggestion-copy">
                <strong>{uiCopy.searchAllPrefix}{trimmedInput}</strong>
                <small>{uiCopy.searchAllMeta}</small>
              </span>
            </button>

            {suggestionsPending && documentSuggestions.length === 0 && tagSuggestions.length === 0 && (
              <div className="header-search__pending" role="status">
                <span className="header-search__pending-spinner" aria-hidden="true" />
                <span>{currentLocale === 'zh' ? '正在加载文档索引…' : 'Loading document index…'}</span>
              </div>
            )}

            {documentSuggestions.length > 0 && (
              <div className="header-search__group">
                <span>{uiCopy.documentGroup}</span>
                {documentSuggestions.map((suggestion) => renderSuggestion(suggestion, suggestions.indexOf(suggestion)))}
              </div>
            )}

            {tagSuggestions.length > 0 && (
              <div className="header-search__group">
                <span>{uiCopy.tagGroup}</span>
                {tagSuggestions.map((suggestion) => renderSuggestion(suggestion, suggestions.indexOf(suggestion)))}
              </div>
            )}
          </div>
        )}

        <div className="header-search-modal__footer">
          <div className="header-search-modal__keys">
            <span><kbd>↑</kbd><kbd>↓</kbd> {uiCopy.navigationKeys}</span>
            <span><kbd>Enter</kbd> {uiCopy.selectKey}</span>
            <span><kbd>Esc</kbd> {uiCopy.closeKey}</span>
          </div>
          <span className="header-search-modal__brand">{uiCopy.poweredBy}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

void SuggestionIcon