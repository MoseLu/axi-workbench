import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MobileIcon } from './MobileIcons';
import { mobilePageTitleKey } from '../lib/navigation';
import { useMobileI18n } from '../i18n';

function ScanGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="currentColor" d="M4 3h5v2H6v3H4V3Zm11 0h5v5h-2V5h-3V3ZM4 16h2v3h3v2H4v-5Zm14 0h2v5h-5v-2h3v-3ZM8 8h8v8H8V8Zm2 2v4h4v-4h-4Z" />
    </svg>
  );
}

/**
 * 从旧移动端迁来的微信式主 Tab 顶栏：标题对整屏绝对居中，
 * 搜索与圆圈加号位于右侧；它不包含 Web 后台的品牌、插件或面包屑。
 */
export function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const title = t(mobilePageTitleKey(location.pathname));

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsidePress);
    return () => document.removeEventListener('mousedown', closeOnOutsidePress);
  }, [menuOpen]);

  return (
    <header className="wb-mobile-topbar">
      <div className="wb-mobile-topbar__inner">
        <h1 className="wb-mobile-topbar__title">{title}</h1>
        <div className="wb-mobile-topbar__actions">
          <button
            type="button"
            className="wb-mobile-topbar__btn"
            onClick={() => navigate('/search')}
            aria-label={t('common.search')}
          >
            <MobileIcon name="search" size={22} strokeWidth={1.9} />
          </button>
          <div className="wb-mobile-topbar__plus-wrap" ref={menuRef}>
            <button
              type="button"
              className="wb-mobile-topbar__btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={t('common.more')}
              aria-expanded={menuOpen}
            >
              <span className="wb-mobile-topbar__plus" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="wb-mobile-topbar__menu" role="menu">
                <div className="wb-mobile-topbar__menu-body">
                  <button
                    type="button"
                    className="wb-mobile-topbar__menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/scan');
                    }}
                  >
                    <ScanGlyph />
                    <span>{t('nav.scan')}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
