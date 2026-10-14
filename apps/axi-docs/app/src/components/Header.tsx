import { useEffect, useRef, useState } from 'react'
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
} from '../config/siteConfig'
import { BookIcon } from './Icons'
import { HeaderTopBar } from './Header/HeaderTopBar'
import { buildLocaleHref, getCurrentDocSet } from './Header/localeRoute'
import { MobileSiteNav } from './Header/MobileSiteNav'
import { SearchModal } from './Header/SearchModal'
import { SuggestionIcon } from './Header/SuggestionIcon'

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
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark')
  const [themeReady, setThemeReady] = useState(false)
  const [inputValue, setInputValue] = useState(searchQuery)
  const [docNavOpen, setDocNavOpen] = useState(false)
  const [siteNavOpen, setSiteNavOpen] = useState(false)
  const [localeOpen, setLocaleOpen] = useState(false)
  const [screenLocaleOpen, setScreenLocaleOpen] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [suggestionsPending, setSuggestionsPending] = useState(false)
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
    setThemeMode(window.localStorage.getItem('axi-docs-theme') === 'light' ? 'light' : 'dark')
    setThemeReady(true)
  }, [])

  useEffect(() => {
    if (!themeReady) return
    document.documentElement.dataset.axiDocsTheme = themeMode
    window.localStorage.setItem('axi-docs-theme', themeMode)
  }, [themeMode, themeReady])

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
      setSuggestionsPending(false)
      return undefined
    }

    const requestId = ++suggestionRequestRef.current
    setSuggestionsPending(true)
    suggestionDebounceRef.current = setTimeout(async () => {
      const next = await getKnowledgeSearchSuggestions(trimmedInput)
      if (requestId !== suggestionRequestRef.current) return

      setSuggestions(next)
      // Start with -1 (no candidate selected) so Enter triggers a full search
      // instead of silently opening the first suggestion.
      setActiveIndex(-1)
      setSuggestionsPending(false)
    }, 120)

    return () => {
      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current)
    }
  }, [searchOpen, trimmedInput])

  const closeSearch = () => {
    setSearchOpen(false)
    setSuggestions([])
    setActiveIndex(-1)
    setSuggestionsPending(false)
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

  const renderSuggestion = (suggestion: SearchSuggestion, suggestionIndex: number) => (
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

  const topNavItems = localeConfig.themeConfig.nav.map((item) => ({
    label: item.text,
    to: buildDocSetRoute(currentLocale, item.docSet),
    active: (pageMode === 'home' || pageMode === 'document') && currentDocSet === item.docSet,
  }))

  return (
    <header className="app-header app-header--command">
      <Link aria-label={uiCopy.homeAria} className="app-logo" to={guideHref}>
        <BookIcon />
        <div className="app-logo__copy">
          <span>{pageCopy.header.brandPrimary}</span>
        </div>
      </Link>

      <HeaderTopBar
        pageMode={pageMode}
        searching={searching}
        pageCopyHeader={pageCopy.header}
        uiCopy={uiCopy}
        openSearch={openSearch}
        topNavItems={topNavItems}
        currentLocale={currentLocale}
        guideHref={guideHref}
        onNavigate={() => {
          setDocNavOpen(false)
          setSiteNavOpen(false)
        }}
        localeOpen={localeOpen}
        setLocaleOpen={setLocaleOpen}
        localeOptions={localeOptions}
        localeMenuRef={localeMenuRef}
        themeMode={themeMode}
        toggleThemeMode={toggleThemeMode}
        siteNavOpen={siteNavOpen}
        setSiteNavOpen={setSiteNavOpen}
        buildLocaleHrefFn={buildLocaleHref}
        pathname={location.pathname}
        search={location.search}
      />

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

      <MobileSiteNav
        open={pageMode !== 'category' && siteNavOpen}
        onClose={() => setSiteNavOpen(false)}
        currentLocale={currentLocale}
        localeConfig={localeConfig}
        localeOptions={localeOptions}
        screenLocaleOpen={screenLocaleOpen}
        setScreenLocaleOpen={setScreenLocaleOpen}
        topNavItems={topNavItems}
        uiCopy={uiCopy}
        themeMode={themeMode}
        toggleThemeMode={toggleThemeMode}
        buildLocaleHrefFn={buildLocaleHref}
        pathname={location.pathname}
        search={location.search}
      />

      <SearchModal
        open={searchOpen}
        inputRef={inputRef}
        inputValue={inputValue}
        onInputChange={setInputValue}
        trimmedInput={trimmedInput}
        suggestions={suggestions}
        documentSuggestions={documentSuggestions}
        tagSuggestions={tagSuggestions}
        suggestionsPending={suggestionsPending}
        activeIndex={activeIndex}
        currentLocale={currentLocale}
        uiCopy={uiCopy}
        renderSuggestion={renderSuggestion}
        pickSuggestion={pickSuggestion}
        submitSearch={submitSearch}
        closeSearch={closeSearch}
        clearSearch={clearSearch}
        setActiveIndex={(updater) => setActiveIndex(updater)}
      />
    </header>
  )
}