import React, { useState, useRef, useEffect } from 'react';
import type { NoticeItem } from '../../../types';
import './style.css';

export interface NotificationIconProps {
  icon: React.ReactNode;
  items?: NoticeItem[];
  count?: number;
  tooltip?: string;
  onItemClick?: (item: NoticeItem) => void;
  onViewAll?: () => void;
}

const NotificationIcon: React.FC<NotificationIconProps> = ({
  icon,
  items = [],
  count,
  tooltip = '通知',
  onItemClick,
  onViewAll,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const displayCount = count ?? items.filter(i => !i.read).length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="mpms-notification" ref={ref}>
      <button
        className="mpms-icon-btn mpms-icon-btn--md"
        title={tooltip}
        onClick={() => setOpen(!open)}
        type="button"
      >
        {icon}
        {displayCount > 0 && (
          <span className="mpms-icon-btn__badge">{displayCount > 99 ? '99+' : displayCount}</span>
        )}
      </button>
      {open && (
        <div className="mpms-notification__dropdown">
          <div className="mpms-notification__header">
            <span>{tooltip}</span>
            <span className="mpms-notification__count">{displayCount} 条未读</span>
          </div>
          <div className="mpms-notification__list">
            {items.length === 0 ? (
              <div className="mpms-notification__empty">暂无{tooltip}</div>
            ) : (
              items.slice(0, 5).map(item => (
                <div
                  key={item.id}
                  className={`mpms-notification__item ${item.read ? 'is-read' : ''}`}
                  onClick={() => { onItemClick?.(item); }}
                >
                  <div className="mpms-notification__item-title">{item.title}</div>
                  {item.description && (
                    <div className="mpms-notification__item-desc">{item.description}</div>
                  )}
                  {item.time && (
                    <div className="mpms-notification__item-time">{item.time}</div>
                  )}
                </div>
              ))
            )}
          </div>
          {items.length > 0 && (
            <div className="mpms-notification__footer" onClick={() => { onViewAll?.(); setOpen(false); }}>
              查看全部
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationIcon;
