import React from 'react';
import './BreadcrumbBar.css';

interface BreadcrumbItem {
  label: string;
  icon?: React.ReactNode;
}

interface BreadcrumbBarProps {
  items: BreadcrumbItem[];
}

const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({ items }) => {
  return (
    <div className="app-breadcrumb">
      <nav className="app-breadcrumb__nav">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="app-breadcrumb__sep">|</span>}
            <span className={`app-breadcrumb__item ${index === items.length - 1 ? 'is-active' : ''}`}>
              {item.icon && <span className="app-breadcrumb__icon">{item.icon}</span>}
              <span className="app-breadcrumb__label">{item.label}</span>
            </span>
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
};

export default BreadcrumbBar;
