import React, { useState } from 'react';
import { Alert, Button, Empty, Input, Space, Typography } from 'antd';
import { AxiTableGroup } from '@axi/crud';
import { useI18n } from '../../../i18n';
import { approveMobilePairing } from '../../../lib/mobilePairing';
import { DesktopSettingsPage } from './DesktopSettingsPage';

/**
 * 登录设备列表尚未接入身份服务时，不展示伪造设备或不可用的“下线”操作。
 * 但已登录 Web 可以作为设备配对的 owner，在不暴露服务端审批密钥的前提下
 * 批准真机上显示的单次配对码。
 */
const Devices: React.FC = () => {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const approve = async () => {
    if (submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const approved = await approveMobilePairing(code);
      setCode('');
      setResult({
        kind: 'success',
        message: approved.deviceName ? `已批准 ${approved.deviceName} 的设备配对。` : '设备配对已批准。',
      });
    } catch (error) {
      setResult({
        kind: 'error',
        message: error instanceof Error ? error.message : '无法批准设备配对。',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DesktopSettingsPage activeKey="/admin/me/devices" title={t('account.devices.title')}>
      <AxiTableGroup title="批准手机配对">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            在手机上发起配对后，将显示的 6 位配对码输入这里。批准不会把服务端审批密钥发送到手机。
          </Typography.Paragraph>
          <Space.Compact style={{ maxWidth: 360, width: '100%' }}>
            <Input
              aria-label="手机配对码"
              value={code}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位配对码"
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onPressEnter={() => void approve()}
            />
            <Button disabled={code.length !== 6} loading={submitting} type="primary" onClick={() => void approve()}>
              批准配对
            </Button>
          </Space.Compact>
          {result ? <Alert showIcon type={result.kind} message={result.message} /> : null}
        </Space>
      </AxiTableGroup>
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
