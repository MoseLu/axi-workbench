import { Outlet, useLocation } from 'react-router-dom';
import { MobileHeader } from '../components/MobileHeader';
import { MobileTabBar } from '../components/MobileTabBar';

/** 独立微信式移动应用壳：不导入 Web 管理端的壳、面包屑或标签栏。 */
export default function MobileShell() {
  const location = useLocation();
  const isScanRoute = location.pathname === '/scan' || location.pathname.startsWith('/scan/');

  if (isScanRoute) {
    return (
      <div className="axi-mobile-app axi-mobile-app--scanner">
        <main className="axi-mobile-content axi-mobile-content--scanner">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="axi-mobile-app">
      <MobileHeader />
      <main className="axi-mobile-content">
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
}
