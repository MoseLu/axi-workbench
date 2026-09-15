import React from 'react';
import './BreadcrumbBar.css';
import type { BreadcrumbItem } from '../../lib/breadcrumbs';

interface BreadcrumbBarProps {
  items: BreadcrumbItem[];
  /** Click handler for intermediate items. The current/active item is never clickable. */
  onNavigate?: (path: string) => void;
}

const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({ items, onNavigate }) => {
  return (
    <div className="app-breadcrumb">
      <nav className="app-breadcrumb__nav" aria-label="面包屑导航">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isCurrent = item.isActive || isLast;
          const interactive = !isCurrent && Boolean(item.path || onNavigate);

          if (isCurrent) {
            // Current page: render as static span with aria-current.
            return (
              <React.Fragment key={`bc-${index}`}>
                {index > 0 && <span className="app-breadcrumb__sep" aria-hidden="true">/</span>}
                <span
                  className="app-breadcrumb__item is-active"
                  aria-current="page"
                >
                  {item.icon && <span className="app-breadcrumb__icon">{item.icon}</span>}
                  <span className="app-breadcrumb__label">{item.label}</span>
                </span>
              </React.Fragment>
            );
          }

          if (interactive) {
            // Intermediate item with a click target: render as button.
            return (
              <React.Fragment key={`bc-${index}`}>
                {index > 0 && <span className="app-breadcrumb__sep" aria-hidden="true">/</span>}
                <button
                  type="button"
                  className="app-breadcrumb__item is-clickable"
                  onClick={() => {
                    if (item.path && onNavigate) onNavigate(item.path);
                  }}
                >
                  {item.icon && <span className="app-breadcrumb__icon">{item.icon}</span>}
                  <span className="app-breadcrumb__label">{item.label}</span>
                </button>
              </React.Fragment>
            );
          }

          // Static intermediate (e.g. parent group label without its own page).
          return (
            <React.Fragment key={`bc-${index}`}>
              {index > 0 && <span className="app-breadcrumb__sep" aria-hidden="true">/</span>}
              <span className="app-breadcrumb__item">
                {item.icon && <span className="app-breadcrumb__icon">{item.icon}</span>}
                <span className="app-breadcrumb__label">{item.label}</span>
              </span>
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
};

export default BreadcrumbBar;
