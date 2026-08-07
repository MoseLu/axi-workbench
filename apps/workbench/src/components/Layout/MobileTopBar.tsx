import React, { useEffect, useRef, useState } from 'react';
import ScanIcon from './ScanIcon';
import searchIcon from '../../assets/ic-wechat-search.png';
import plusIcon from '../../assets/ic-wechat-plus.png';
import './MobileTopBar.css';

type Props = {
  title: string;
  onSearchClick?: () => void;
  onScanClick?: () => void;
};

/**
 * 主 Tab 顶栏：右侧图标来自微信真机截图提取，纯黑细线风格。
 */
const MobileTopBar: React.FC<Props> = ({ title, onSearchClick, onScanClick }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <header className="wb-mobile-topbar">
      <div className="wb-mobile-topbar__inner">
        <h1 className="wb-mobile-topbar__title">{title}</h1>
        <div className="wb-mobile-topbar__actions">
          <button type="button" className="wb-mobile-topbar__btn" onClick={onSearchClick} aria-label="搜索">
            <img className="wb-mobile-topbar__icon-img" src={searchIcon} alt="" />
          </button>
          <div className="wb-mobile-topbar__plus-wrap" ref={menuRef}>
            <button
              type="button"
              className="wb-mobile-topbar__btn wb-mobile-topbar__plus-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="更多"
              aria-expanded={menuOpen}
            >
              <img className="wb-mobile-topbar__icon-img" src={plusIcon} alt="" />
            </button>
            {menuOpen && (
              <div className="wb-mobile-topbar__menu" role="menu">
                <div className="wb-mobile-topbar__menu-body">
                  <button
                    type="button"
                    className="wb-mobile-topbar__menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onScanClick?.();
                    }}
                  >
                    <ScanIcon size={18} color="var(--color-bg-chrome)" />
                    <span>扫一扫</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default MobileTopBar;
