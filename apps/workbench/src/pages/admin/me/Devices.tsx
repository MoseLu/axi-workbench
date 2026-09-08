import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, QRCode, Space, Typography } from 'antd';
import { AxiTableGroup } from '@axi/crud';
import { useI18n } from '../../../i18n';
import {
  approveMobilePairingQr,
  createMobilePairingQr,
  getMobilePairingQrStatus,
  mobilePairingQrPayload,
  type MobilePairingQr,
  type MobilePairingQrStatus,
} from '../../../lib/mobilePairing';
import { DesktopSettingsPage } from './DesktopSettingsPage';

/**
 * 登录设备列表尚未接入身份服务时，不展示伪造设备或不可用的“下线”操作。
 * 已登录 Web 是手机配对的 owner：二维码只有短时扫码能力，手机扫码后仍必须由
 * Web owner 明确确认，且手机从未收到服务端审批密钥。
 */
const Devices: React.FC = () => {
  const { t } = useI18n();
  const [pairing, setPairing] = useState<MobilePairingQr | null>(null);
  const [status, setStatus] = useState<MobilePairingQrStatus | null>(null);
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qrValue = useMemo(() => (pairing ? mobilePairingQrPayload(pairing) : ''), [pairing]);
  const pairingId = pairing?.webPairingId;
  const pairingStatus = status?.status;

  useEffect(() => {
    if (!pairingId || pairingStatus === 'approved' || pairingStatus === 'expired') return undefined;

    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await getMobilePairingQrStatus(pairingId);
        if (!cancelled) {
          setStatus(next);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '无法刷新手机配对状态');
      }
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pairingId, pairingStatus]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const next = await createMobilePairingQr();
      setPairing(next);
      setStatus({ status: 'waiting_scan', expiresAt: next.expiresAt });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法生成手机配对二维码');
    } finally {
      setCreating(false);
    }
  };

  const approve = async () => {
    if (!pairing || approving || status?.status !== 'scanned') return;
    setApproving(true);
    setError(null);
    try {
      const approved = await approveMobilePairingQr(pairing.webPairingId);
      setStatus({
        status: 'approved',
        expiresAt: status.expiresAt,
        deviceName: approved.deviceName ?? status.deviceName,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法确认手机配对');
    } finally {
      setApproving(false);
    }
  };

  const statusAlert = (() => {
    if (!status) return null;
    if (status.status === 'waiting_scan') {
      return <Alert showIcon type="info" message="等待手机扫码" description="打开手机端的扫一扫，对准这里的二维码。" />;
    }
    if (status.status === 'scanned') {
      return (
        <Alert
          showIcon
          type="success"
          message={status.deviceName ? `已扫描：${status.deviceName}` : '手机已扫描'}
          description="请核对设备后点击“确认此设备配对”；未确认前手机无法访问工作区。"
        />
      );
    }
    if (status.status === 'approved') {
      return (
        <Alert
          showIcon
          type="success"
          message={status.deviceName ? `${status.deviceName} 已完成配对` : '手机已完成配对'}
          description="手机会自动取得受限工作区访问令牌。"
        />
      );
    }
    return <Alert showIcon type="warning" message="二维码已过期" description="请生成一张新的二维码后再扫描。" />;
  })();

  return (
    <DesktopSettingsPage activeKey="/admin/me/devices" title={t('account.devices.title')}>
      <AxiTableGroup title="扫码配对手机">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            生成一次性二维码后，用真机扫一扫。扫码只会登记待确认设备；必须在此页确认，手机才会取得访问权限。
          </Typography.Paragraph>
          {pairing ? (
            <Space direction="vertical" size={12} align="center" style={{ width: '100%' }}>
              <QRCode aria-label="手机配对二维码" value={qrValue} size={208} errorLevel="M" />
              {statusAlert}
              <Space wrap>
                <Button loading={creating} onClick={() => void create()}>
                  重新生成二维码
                </Button>
                <Button
                  disabled={status?.status !== 'scanned'}
                  loading={approving}
                  type="primary"
                  onClick={() => void approve()}
                >
                  确认此设备配对
                </Button>
              </Space>
            </Space>
          ) : (
            <Button loading={creating} type="primary" onClick={() => void create()}>
              生成配对二维码
            </Button>
          )}
          {error ? <Alert showIcon type="error" message={error} /> : null}
          <Typography.Text type="secondary">
            6 位配对码仅保留给尚未升级的旧手机客户端；当前版本默认使用扫码配对。
          </Typography.Text>
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
