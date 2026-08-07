import { Outlet } from 'react-router-dom';
import { MobileHeader } from '../components/MobileHeader';
import { MobileTabBar } from '../components/MobileTabBar';

/** 独立微信式移动应用壳：不导入 Web 管理端的壳、面包屑或标签栏。 */
export default function MobileShell() {
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
