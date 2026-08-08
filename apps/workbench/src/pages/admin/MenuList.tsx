import React from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';
import { getRegisteredDesktopRoutes } from '../../lib/navigationRegistry';
import './MenuList.css';

const MenuList: React.FC = () => {
  const navigate = useNavigate();
  const routes = getRegisteredDesktopRoutes();

  return (
    <main className="menu-registry" aria-labelledby="menu-registry-title">
      <h1 className="menu-registry__visually-hidden" id="menu-registry-title">菜单配置</h1>
      <section className="menu-registry__toolbar" aria-label="导航入口">
        <strong>导航入口</strong>
        <span>{routes.length} 个</span>
      </section>

      <section className="menu-registry__list" aria-label="已登记导航入口">
        {routes.map((route) => (
          <button className="menu-registry__row" key={route.path} onClick={() => navigate(route.path)} type="button">
            <span className="menu-registry__row-icon"><WorkbenchIcon name="menu" size={16} /></span>
            <span className="menu-registry__row-copy">
              <strong>{route.label}</strong>
              <small>{route.groupLabel}</small>
            </span>
            <WorkbenchIcon aria-label={`${route.label} 详情`} name="forward" size={14} />
          </button>
        ))}
      </section>
    </main>
  );
};

export default MenuList;
