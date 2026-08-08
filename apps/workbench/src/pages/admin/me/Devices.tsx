import React from 'react';
import { Empty } from 'antd';
import { AxiTableGroup } from '@axi/crud';
import { DesktopSettingsPage } from './DesktopSettingsPage';

/**
 * 设备会话尚未接入身份服务时，不展示伪造设备或不可用的“下线”操作。
 */
const Devices: React.FC = () => (
  <DesktopSettingsPage activeKey="/admin/me/devices" title="设备管理">
    <AxiTableGroup title="登录设备">
      <Empty
        description="当前环境尚未接入设备会话数据"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    </AxiTableGroup>
  </DesktopSettingsPage>
);

export default Devices;
