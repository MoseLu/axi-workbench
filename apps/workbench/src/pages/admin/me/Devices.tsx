import React from 'react';
import { Empty } from 'antd';
import { AxiTableGroup } from '@axi/crud';
import { useI18n } from '../../../i18n';
import { DesktopSettingsPage } from './DesktopSettingsPage';

/**
 * 设备会话尚未接入身份服务时，不展示伪造设备或不可用的"下线"操作。
 */
const Devices: React.FC = () => {
  const { t } = useI18n();
  return (
    <DesktopSettingsPage activeKey="/admin/me/devices" title={t('account.devices.title')}>
      <AxiTableGroup title={t('account.devices.group')}>
        <Empty
          description={t('account.devices.empty')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </AxiTableGroup>
    </DesktopSettingsPage>
  );
};

export default Devices;
