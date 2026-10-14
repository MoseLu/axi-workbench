import { Link } from 'react-router-dom'
import type { SiteLocale } from '../../config/siteConfig'
import { GitHubIcon, LanguageIcon, MoonIcon, ThemeIcon } from '../Icons'
import { buildLocaleHref } from './localeRoute'

interface MobileSiteNavProps {
  open: boolean
  onClose: () => void
  currentLocale: SiteLocale
  localeConfig: { label: string }
  localeOptions: Array<{ code: SiteLocale; label: string }>
  screenLocaleOpen: boolean
  setScreenLocaleOpen: (next: boolean) => void
  topNavItems: Array<{ label: string; to: string; active: boolean }>
  uiCopy: {
    languageLabel: string
    siteToolsLabel: string
    switchToLight: string
    switchToDark: string
    switchToLightTitle: string
    switchToDarkTitle: string
  }
  themeMode: 'dark' | 'light'
  toggleThemeMode: () => void
  buildLocaleHrefFn: typeof buildLocaleHref
  pathname: string
  search: string
}

export function MobileSiteNav({
  open,
  onClose,
  currentLocale,
  localeConfig,
  localeOptions,
  screenLocaleOpen,
  setScreenLocaleOpen,
  topNavItems,
  uiCopy,
  themeMode,
  toggleThemeMode,
  buildLocaleHrefFn,
  pathname,
  search,
}: MobileSiteNavProps) {
  if (!open) return null
  return (
    <>
      <button
        aria-label={currentLocale === 'zh' ? '关闭导航遮罩' : 'Close navigation backdrop'}
        className="header-vp-nav-backdrop"
        data-testid="header-nav-backdrop"
        onClick={onClose}
        type="button"
      />
      <div className="header-vp-screen">
        <div className="header-vp-screen__content">
          <nav aria-label="移动端顶部导航">
            {topNavItems.map((item) => (
              <Link
                key={`${item.label}:screen`}
                className={`header-vp-screen__link${item.active ? ' active' : ''}`}
                onClick={onClose}
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
              onClick={() => setScreenLocaleOpen(!screenLocaleOpen)}
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
                      onClick={onClose}
                      to={buildLocaleHrefFn(pathname, search, locale.code)}
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
  )
}