import { AxiLogoMark } from '@axi/core';
import { AxiFloatingToolDock } from '@axi/shell';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MobileHeader } from '../components/MobileHeader';
import { MobileTabBar } from '../components/MobileTabBar';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

/** 独立微信式移动应用壳：不导入 Web 管理端的壳、面包屑或标签栏。 */
export default function MobileShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useMobileI18n();
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
      <AxiFloatingToolDock
        className="axi-mobile-floating-tools"
        label={t('common.quickTools')}
        triggerLabel={t('common.openQuickTools')}
        closeLabel={t('common.closeQuickTools')}
        brandIcon={<AxiLogoMark size={16} />}
        triggerIcon={<MobileIcon name="arrow-right" size={14} />}
        openTriggerIcon={<MobileIcon name="back" size={14} />}
        items={[
          {
            key: 'search',
            label: t('common.search'),
            icon: <MobileIcon name="search" size={17} />,
            onClick: () => navigate('/search'),
          },
          {
            key: 'scan',
            label: t('nav.scan'),
            icon: <MobileIcon name="scan" size={17} />,
            onClick: () => navigate('/scan'),
          },
          {
            key: 'inbox',
            label: t('page.inbox'),
            icon: <MobileIcon name="inbox" size={17} />,
            onClick: () => navigate('/inbox'),
          },
        ]}
        renderPanel={(item) => (
          <div className="axi-mobile-floating-tools__panel">
            <strong>{item?.label ?? t('common.quickTools')}</strong>
            <span>{t('common.quickToolsHint')}</span>
          </div>
        )}
      />
    </div>
  );
}
