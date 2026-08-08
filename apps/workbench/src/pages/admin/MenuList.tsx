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
      <header className="menu-registry__hero">
        <div>
          <span className="menu-registry__eyebrow">WORKBENCH · NAVIGATION REGISTRY</span>
          <h1 id="menu-registry-title">菜单配置</h1>
          <p>这里读取当前 Web 壳已注册的导航项；没有未保存的样例菜单或不可用的开关。</p>
        </div>
        <span className="menu-registry__count"><WorkbenchIcon name="menu" size={16} />{routes.length} 个已注册入口</span>
      </header>

      <section className="menu-registry__panel" aria-label="已注册的导航菜单">
        <header className="menu-registry__panel-header"><h2><WorkbenchIcon name="folder" size={16} />桌面导航</h2><span>点击任意条目打开对应页面</span></header>
        <div className="menu-registry__list">
          {routes.map((route) => (
            <button className="menu-registry__row" key={route.path} onClick={() => navigate(route.path)} type="button">
              <span className="menu-registry__row-icon"><WorkbenchIcon name="menu" size={16} /></span>
              <span className="menu-registry__row-copy"><strong>{route.label}</strong><small>{route.path}</small></span>
              <span className="menu-registry__group">{route.groupLabel} · {route.order}</span>
              <span className="menu-registry__status"><i aria-hidden="true" />已注册</span>
              <WorkbenchIcon name="forward" size={14} />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
};

export default MenuList;
