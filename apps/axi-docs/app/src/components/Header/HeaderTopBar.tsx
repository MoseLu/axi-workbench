import { Link } from 'react-router-dom'
import type { SiteLocale } from '../../config/siteConfig'
import { BookIcon, GitHubIcon, LanguageIcon, MoonIcon, SearchIcon, ThemeIcon } from '../Icons'
import { buildLocaleHref } from './localeRoute'

interface HeaderTopBarProps {
  pageMode: 'home' | 'category' | 'search' | 'document' | 'explorer'
  searching: boolean
  pageCopyHeader: { brandPrimary: string; searchLabel: string }
  uiCopy: {
    homeAria: string
    globalSearch: string
    topNavLabel: string
    siteToolsLabel: string
    languageLabel: string
    switchToLight: string
    switchToDark: string
    switchToLightTitle: string
    switchToDarkTitle: string
    openMenu: string
    closeMenu: string
  }
  openSearch: () => void
  topNavItems: Array<{ label: string; to: string; active: boolean }>
  currentLocale: SiteLocale
  guideHref: string
  onNavigate: () => void
  localeOpen: boolean
  setLocaleOpen: (next: boolean) => void
  localeOptions: Array<{ code: SiteLocale; label: string }>
  localeMenuRef: React.RefObject<HTMLDivElement | null>
  themeMode: 'dark' | 'light'
  toggleThemeMode: () => void
  siteNavOpen: boolean
  setSiteNavOpen: (next: boolean) => void
  buildLocaleHrefFn: typeof buildLocaleHref
  pathname: string
  search: string
}

export function HeaderTopBar({
  pageMode,
  searching,
  pageCopyHeader,
  uiCopy,
  openSearch,
  topNavItems,
  guideHref,
  onNavigate,
  localeOpen,
  setLocaleOpen,
  localeOptions,
  localeMenuRef,
  currentLocale,
  themeMode,
  toggleThemeMode,
  siteNavOpen,
  setSiteNavOpen,
  buildLocaleHrefFn,
  pathname,
  search,
}: HeaderTopBarProps) {
  if (pageMode === 'category') {
    return (
      <header className="app-header app-header--command">
        <Link aria-label={uiCopy.homeAria} className="app-logo" to={guideHref}>
          <BookIcon />
          <div className="app-logo__copy">
            <span>{pageCopyHeader.brandPrimary}</span>
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
              <span className="header-search__trigger-text">{pageCopyHeader.searchLabel}</span>
              <kbd>⌘K</kbd>
            </button>
          </div>
        </div>
      </header>
    )
  }
  return (
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
          <span className="header-search__trigger-text">{pageCopyHeader.searchLabel}</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      <nav aria-label={uiCopy.topNavLabel} className="header-vp-nav">
        {topNavItems.map((item) => (
          <Link
            key={item.label}
            className={`header-vp-nav__link${item.active ? ' active' : ''}`}
            onClick={onNavigate}
            to={item.to}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="header-vp-tools" aria-label={uiCopy.siteToolsLabel}>
        <div className="header-vp-locale" ref={localeMenuRef as React.RefObject<HTMLDivElement>}>
          <button
            aria-expanded={localeOpen}
            aria-haspopup="menu"
            aria-label={uiCopy.languageLabel}
            className="header-vp-tool header-vp-tool--locale"
            onClick={() => setLocaleOpen(!localeOpen)}
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
                  to={buildLocaleHrefFn(pathname, search, locale.code)}
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
        onClick={() => setSiteNavOpen(!siteNavOpen)}
        type="button"
      >
        <span className="header-vp-menu__icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
    </div>
  )
}