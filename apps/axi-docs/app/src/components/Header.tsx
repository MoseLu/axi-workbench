import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { getKnowledgeSearchSuggestions } from '../lib/knowledgeClient'
import type { SearchSuggestion } from '../types'
import { getPageCopy } from '../config/pageCopy'
import {
  buildDocSetRoute,
  getDefaultGuideRoute,
  getLocaleOptions,
  getSiteLocaleConfig,
  resolveSiteLocaleFromPath,
  type DocSetId,
  type SiteLocale,
} from '../config/siteConfig'
import { BookIcon, FileIcon, GitHubIcon, LanguageIcon, MoonIcon, SearchIcon, TagIcon, ThemeIcon } from './Icons'

interface HeaderProps {
  activeDocSet?: DocSetId
  onSearchChange: (query: string) => void
  onSearchSubmit: (query: string) => void
  onSuggestionSelect: (suggestion: SearchSuggestion) => void
  pageMode: 'home' | 'category' | 'search' | 'document' | 'explorer'
  searchQuery: string
  searching: boolean
}

const localeOptions = getLocaleOptions()

function SuggestionIcon({ kind }: Pick<SearchSuggestion, 'kind'>) {
  if (kind === 'tag') return <TagIcon />
  return <FileIcon />
}

function getCurrentDocSet(pathname: string): DocSetId {
  if (/^\/(zh|en)\/skills(?:\/|$)/u.test(pathname)) return 'skills'
  if (/^\/(zh|en)\/workspace(?:\/|$)/u.test(pathname)) return 'workspace'
  return 'guide'
}

function buildLocaleHref(pathname: string, search: string, locale: SiteLocale): string {
  if (/^\/(zh|en)\//u.test(pathname)) {
    return `${pathname.replace(/^\/(zh|en)\//u, `/${locale}/`)}${search}`
  }

  return getDefaultGuideRoute(locale)
}

export function Header({
  activeDocSet,
  onSearchChange,
  onSearchSubmit,
  onSuggestionSelect,
  pageMode,
  searchQuery,
  searching,
}: HeaderProps) {
  const location = useLocation()
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => (
    window.localStorage.getItem('axi-docs-theme') === 'light' ? 'light' : 'dark'
  ))
  const [inputValue, setInputValue] = useState(searchQuery)
  const [docNavOpen, setDocNavOpen] = useState(false)
  const [siteNavOpen, setSiteNavOpen] = useState(false)
  const [localeOpen, setLocaleOpen] = useState(false)
  const [screenLocaleOpen, setScreenLocaleOpen] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const localeMenuRef = useRef<HTMLDivElement | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const themeSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionRequestRef = useRef(0)

  const trimmedInput = inputValue.trim()
  const currentLocale = resolveSiteLocaleFromPath(location.pathname)
  const localeConfig = getSiteLocaleConfig(currentLocale)
  const uiCopy = localeConfig.ui.header
  const pageCopy = getPageCopy(currentLocale)
  const mobileMenuLabel = currentLocale === 'zh' ? '菜单' : 'Menu'
  const currentDocSet = activeDocSet || getCurrentDocSet(location.pathname)
  const guideHref = getDefaultGuideRoute(currentLocale)
  const documentSuggestions = suggestions.filter((suggestion) => suggestion.kind === 'document')
  const tagSuggestions = suggestions.filter((suggestion) => suggestion.kind === 'tag')

  useEffect(() => {
    document.documentElement.dataset.axiDocsTheme = themeMode
    window.localStorage.setItem('axi-docs-theme', themeMode)
  }, [themeMode])

  useEffect(() => () => {
    if (themeSwitchTimerRef.current) clearTimeout(themeSwitchTimerRef.current)
    document.documentElement.classList.remove('axi-theme-switching')
  }, [])

  useEffect(() => {
    if (!searchOpen) setInputValue(searchQuery)
  }, [searchOpen, searchQuery])

  useEffect(() => {
    setDocNavOpen(false)
    setSiteNavOpen(false)
    setLocaleOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (siteNavOpen) setScreenLocaleOpen(true)
  }, [siteNavOpen])

  useEffect(() => {
    if (!localeOpen) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!localeMenuRef.current?.contains(event.target as Node)) {
        setLocaleOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLocaleOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [localeOpen])

  useEffect(() => {
    if (pageMode === 'category') {
      setDocNavOpen(false)
      document.documentElement.classList.remove('axi-doc-nav-open')
      return undefined
    }

    document.documentElement.classList.toggle('axi-doc-nav-open', docNavOpen)
    return () => {
      document.documentElement.classList.remove('axi-doc-nav-open')
    }
  }, [docNavOpen, pageMode])

  useEffect(() => {
    document.documentElement.classList.toggle('axi-search-open', searchOpen)
    return () => {
      document.documentElement.classList.remove('axi-search-open')
    }
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) return undefined

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [searchOpen])

  useEffect(() => {
    const handleGlobalSearchShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditable = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        return
      }

      if (!isEditable && event.key === '/') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleGlobalSearchShortcut)
    return () => window.removeEventListener('keydown', handleGlobalSearchShortcut)
  }, [])

  useEffect(() => {
    if (pageMode !== 'search') return undefined
    if (inputValue === searchQuery) return undefined

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      onSearchChange(inputValue)
    }, 220)

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [inputValue, onSearchChange, pageMode, searchQuery])

  useEffect(() => {
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current)

    if (!searchOpen || !trimmedInput) {
      setSuggestions([])
      setActiveIndex(-1)
      return undefined
    }

    const requestId = ++suggestionRequestRef.current
    suggestionDebounceRef.current = setTimeout(async () => {
      const next = await getKnowledgeSearchSuggestions(trimmedInput)
      if (requestId !== suggestionRequestRef.current) return

      setSuggestions(next)
      setActiveIndex(next.length > 0 ? 0 : -1)
    }, 120)

    return () => {
      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current)
    }
  }, [searchOpen, trimmedInput])

  const closeSearch = () => {
    setSearchOpen(false)
    setSuggestions([])
    setActiveIndex(-1)
  }

  const openSearch = () => {
    setInputValue(searchQuery)
    setSearchOpen(true)
  }

  const toggleThemeMode = () => {
    document.documentElement.classList.add('axi-theme-switching')
    if (themeSwitchTimerRef.current) clearTimeout(themeSwitchTimerRef.current)
    themeSwitchTimerRef.current = setTimeout(() => {
      document.documentElement.classList.remove('axi-theme-switching')
      themeSwitchTimerRef.current = null
    }, 180)
    setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const submitSearch = (value: string) => {
    const nextValue = value.trim()
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    closeSearch()
    onSearchSubmit(nextValue)
  }

  const clearSearch = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current)
    setInputValue('')
    setSuggestions([])
    setActiveIndex(-1)
    onSearchChange('')
  }

  const pickSuggestion = (suggestion: SearchSuggestion) => {
    setInputValue(suggestion.query)
    closeSearch()
    onSuggestionSelect(suggestion)
  }

  const renderSuggestion = (suggestion: SearchSuggestion) => {
    const suggestionIndex = suggestions.indexOf(suggestion)
    return (
      <button
        key={`${suggestion.kind}:${suggestion.path || suggestion.label}`}
        aria-selected={suggestionIndex === activeIndex}
        className={`header-search__suggestion${suggestionIndex === activeIndex ? ' active' : ''}`}
        onMouseDown={(event) => {
          event.preventDefault()
          pickSuggestion(suggestion)
        }}
        role="option"
        type="button"
      >
        <span className="header-search__suggestion-icon">
          <SuggestionIcon kind={suggestion.kind} />
        </span>
        <span className="header-search__suggestion-copy">
          <strong>{suggestion.label}</strong>
          {suggestion.meta && <small>{suggestion.meta}</small>}
        </span>
      </button>
    )
  }

  const topNavItems = [
    ...localeConfig.themeConfig.nav.map((item) => ({
      label: item.text,
      to: buildDocSetRoute(currentLocale, item.docSet),
      active: (pageMode === 'home' || pageMode === 'document') && currentDocSet === item.docSet,
    })),
  ]

  const searchModal = searchOpen ? createPortal(
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
            ref={inputRef}
            id="header-search-input"
            aria-autocomplete="list"
            aria-controls="header-search-suggestions"
            aria-expanded={suggestions.length > 0}
            aria-label={uiCopy.searchInputLabel}
            className="header-search-input"
            placeholder={uiCopy.searchPlaceholder}
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
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

            {documentSuggestions.length > 0 && (
              <div className="header-search__group">
                <span>{uiCopy.documentGroup}</span>
                {documentSuggestions.map(renderSuggestion)}
              </div>
            )}

            {tagSuggestions.length > 0 && (
              <div className="header-search__group">
                <span>{uiCopy.tagGroup}</span>
                {tagSuggestions.map(renderSuggestion)}
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
  ) : null

  return (
    <header className="app-header app-header--command">
      <Link aria-label={uiCopy.homeAria} className="app-logo" to={guideHref}>
        <BookIcon />
        <div className="app-logo__copy">
          <span>{pageCopy.header.brandPrimary}</span>
        </div>
      </Link>

      <div className="header-actions">
        <div className="header-search header-search--global">
          <button
            aria-keyshortcuts="Meta+K Control+K"
            aria-label={uiCopy.globalSearch}
            className="header-search__trigger"
            onClick={openSearch}
            type="button"
          >
            <span className="search-icon-wrap" data-testid="search-icon-wrap">
              {searching ? (
                <span className="search-spinner" />
              ) : (
                <SearchIcon />
              )}
            </span>
            <span className="header-search__trigger-text">{pageCopy.header.searchLabel}</span>
            <kbd>⌘K</kbd>
          </button>
        </div>

        {pageMode !== 'category' && (
          <>
            <nav aria-label={uiCopy.topNavLabel} className="header-vp-nav">
              {topNavItems.map((item) => (
                <Link
                  key={item.label}
                  className={`header-vp-nav__link${item.active ? ' active' : ''}`}
                  onClick={() => {
                    setDocNavOpen(false)
                    setSiteNavOpen(false)
                  }}
                  to={item.to}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="header-vp-tools" aria-label={uiCopy.siteToolsLabel}>
              <div className="header-vp-locale" ref={localeMenuRef}>
                <button
                  aria-expanded={localeOpen}
                  aria-haspopup="menu"
                  aria-label={uiCopy.languageLabel}
                  className="header-vp-tool header-vp-tool--locale"
                  onClick={() => setLocaleOpen((current) => !current)}
                  type="button"
                >
                  <LanguageIcon />
                  <span aria-hidden="true" className="header-vp-tool__caret">⌄</span>
                </button>
                {localeOpen && (
                  <div className="header-vp-locale-menu" role="menu">
                    {localeOptions.map((locale) => (
                      <Link
                        key={locale.code}
                        aria-current={locale.code === currentLocale ? 'page' : undefined}
                        className={`header-vp-locale-menu__item${locale.code === currentLocale ? ' active' : ''}`}
                        onClick={() => setLocaleOpen(false)}
                        role="menuitem"
                        to={buildLocaleHref(location.pathname, location.search, locale.code)}
                      >
                        {locale.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <span className="header-vp-separator" aria-hidden="true" />
              <button
                aria-label={themeMode === 'dark' ? uiCopy.switchToLight : uiCopy.switchToDark}
                aria-checked={themeMode === 'dark'}
                className={`header-vp-tool header-vp-tool--theme header-vp-theme-toggle header-vp-theme-toggle--${themeMode}`}
                onClick={toggleThemeMode}
                role="switch"
                title={themeMode === 'dark' ? uiCopy.switchToLightTitle : uiCopy.switchToDarkTitle}
                type="button"
              >
                <span className="header-vp-theme-toggle__track" aria-hidden="true">
                  <span className="header-vp-theme-toggle__thumb">
                    {themeMode === 'dark' ? <MoonIcon /> : <ThemeIcon />}
                  </span>
                </span>
              </button>
              <span className="header-vp-separator" aria-hidden="true" />
              <a
                aria-label="GitHub"
                className="header-vp-tool"
                href="https://github.com/axiomaticworld/axi-docs"
                rel="noreferrer"
                target="_blank"
              >
                <GitHubIcon />
              </a>
            </div>
            <button
              aria-expanded={siteNavOpen}
              aria-label={siteNavOpen ? uiCopy.closeMenu : uiCopy.openMenu}
              className={`header-vp-menu${siteNavOpen ? ' active' : ''}`}
              onClick={() => setSiteNavOpen((current) => !current)}
              type="button"
            >
              <span className="header-vp-menu__icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </>
        )}
      </div>

      {pageMode !== 'category' && (
        <button
          aria-expanded={docNavOpen}
          className={`header-vp-doc-menu${docNavOpen ? ' active' : ''}`}
          onClick={() => setDocNavOpen((current) => !current)}
          type="button"
        >
          <span className="header-vp-menu__icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>{mobileMenuLabel}</span>
        </button>
      )}

      {pageMode !== 'category' && siteNavOpen && (
        <>
          <button
            aria-label={currentLocale === 'zh' ? '关闭导航遮罩' : 'Close navigation backdrop'}
            className="header-vp-nav-backdrop"
            data-testid="header-nav-backdrop"
            onClick={() => setSiteNavOpen(false)}
            type="button"
          />
          <div className="header-vp-screen">
            <div className="header-vp-screen__content">
              <nav aria-label="移动端顶部导航">
                {topNavItems.map((item) => (
                  <Link
                    key={`${item.label}:screen`}
                    className={`header-vp-screen__link${item.active ? ' active' : ''}`}
                    onClick={() => setSiteNavOpen(false)}
                    to={item.to}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="header-vp-screen__group header-vp-screen__group--locale" aria-label={uiCopy.languageLabel} role="group">
                <button
                  aria-controls="header-vp-screen-locale-list"
                  aria-expanded={screenLocaleOpen}
                  className="header-vp-screen__locale-trigger"
                  onClick={() => setScreenLocaleOpen((current) => !current)}
                  type="button"
                >
                  <span className="header-vp-screen__locale-current">
                    <LanguageIcon />
                    <span>{localeConfig.label}</span>
                  </span>
                  <span aria-hidden="true" className="header-vp-screen__locale-caret">⌄</span>
                </button>
                {screenLocaleOpen && (
                  <div className="header-vp-screen__locale-list" id="header-vp-screen-locale-list">
                    {localeOptions
                      .filter((locale) => locale.code !== currentLocale)
                      .map((locale) => (
                        <Link
                          key={`${locale.code}:screen`}
                          className="header-vp-screen__link header-vp-screen__locale-link"
                          onClick={() => setSiteNavOpen(false)}
                          to={buildLocaleHref(location.pathname, location.search, locale.code)}
                        >
                          {locale.label}
                        </Link>
                      ))}
                  </div>
                )}
              </div>
              <div className="header-vp-screen__group header-vp-screen__group--tools" aria-label={uiCopy.siteToolsLabel}>
                <div className="header-vp-screen__theme-row">
                  <span>{currentLocale === 'zh' ? '主题' : 'Theme'}</span>
                  <button
                    aria-label={themeMode === 'dark' ? uiCopy.switchToLight : uiCopy.switchToDark}
                    aria-checked={themeMode === 'dark'}
                    className={`header-vp-tool header-vp-tool--theme header-vp-theme-toggle header-vp-theme-toggle--${themeMode}`}
                    onClick={toggleThemeMode}
                    role="switch"
                    title={themeMode === 'dark' ? uiCopy.switchToLightTitle : uiCopy.switchToDarkTitle}
                    type="button"
                  >
                    <span className="header-vp-theme-toggle__track" aria-hidden="true">
                      <span className="header-vp-theme-toggle__thumb">
                        {themeMode === 'dark' ? <MoonIcon /> : <ThemeIcon />}
                      </span>
                    </span>
                  </button>
                </div>
                <a
                  aria-label="GitHub"
                  className="header-vp-screen__social-link"
                  href="https://github.com/axiomaticworld/axi-docs"
                  rel="noreferrer"
                  target="_blank"
                >
                  <GitHubIcon />
                </a>
              </div>
            </div>
          </div>
        </>
      )}

      {searchModal}
    </header>
  )
}
