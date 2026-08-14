import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MobileIcon } from './MobileIcons';
import { mobilePageTitleKey } from '../lib/navigation';
import { useMobileI18n } from '../i18n';

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
  const isProfilePage = location.pathname === '/me';

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
        <h1 className={`wb-mobile-topbar__title${isProfilePage ? ' wb-mobile-topbar__title--with-profile-actions' : ''}`}>{title}</h1>
        <div className="wb-mobile-topbar__actions">
          {isProfilePage ? (
            <button
              type="button"
              className="wb-mobile-topbar__btn wb-mobile-topbar__btn--scan"
              onClick={() => navigate('/login/confirm-web')}
              aria-label="扫码确认电脑登录"
              title="扫码确认电脑登录"
            >
              <MobileIcon name="scan" size={20} />
            </button>
          ) : null}
          <button
            type="button"
            className="wb-mobile-topbar__btn"
            onClick={() => navigate('/search')}
            aria-label={t('common.search')}
          >
            <MobileIcon name="search" size={20} />
          </button>
          <div className="wb-mobile-topbar__plus-wrap" ref={menuRef}>
            <button
              type="button"
              className="wb-mobile-topbar__btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={t('common.more')}
              aria-expanded={menuOpen}
            >
              <MobileIcon className="wb-mobile-topbar__plus" name="plus" size={20} />
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
                    <MobileIcon name="scan" size={18} />
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
