import React from 'react';
import type { BreadcrumbItem } from '../../types';
import './style.css';

export interface BreadcrumbBarProps {
  items: BreadcrumbItem[];
  separator?: string;
  className?: string;
}

const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({
  items,
  separator = '|',
  className = '',
}) => {
  return (
    <div className={`mpms-breadcrumb ${className}`}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            <span className={`mpms-breadcrumb__item ${isLast ? 'is-active' : ''}`}>
              {item.icon && <span className="mpms-breadcrumb__item-icon">{item.icon}</span>}
              <span className="mpms-breadcrumb__item-label">{item.label}</span>
            </span>
            {!isLast && <span className="mpms-breadcrumb__separator">{separator}</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default BreadcrumbBar;
