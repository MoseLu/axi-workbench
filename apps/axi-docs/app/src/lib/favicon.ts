const NORMAL_FAVICON = '/favicon.svg'
const LOADING_FAVICON = '/favicon-loading.svg'

function updateFavicon(href: string) {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (!link) return
  if (link.getAttribute('href') === href) return
  link.type = 'image/svg+xml'
  link.href = href
}

export function setLoadingFavicon() {
  updateFavicon(LOADING_FAVICON)
}

export function setReadyFavicon() {
  updateFavicon(NORMAL_FAVICON)
}

function isInternalNavigation(anchor: HTMLAnchorElement, event: MouseEvent) {
  return event.button === 0
    && !event.defaultPrevented
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && anchor.origin === window.location.origin
    && (anchor.pathname !== window.location.pathname || anchor.search !== window.location.search)
}

export function installFaviconNavigationState() {
  const handleClick = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]')
    if (anchor && isInternalNavigation(anchor, event)) setLoadingFavicon()
  }
  const handleUnload = () => setLoadingFavicon()

  document.addEventListener('click', handleClick, true)
  window.addEventListener('beforeunload', handleUnload)
  window.addEventListener('pagehide', handleUnload)

  return () => {
    document.removeEventListener('click', handleClick, true)
    window.removeEventListener('beforeunload', handleUnload)
    window.removeEventListener('pagehide', handleUnload)
  }
}
