/**
 * 工作台登录页 — 二维码登录面板。
 *
 * 渲染逻辑与原 Login.tsx 内联块逐字一致（含未走 i18n 的中文提示文案）：
 * QRCode 渲染、加载/失败/过期覆盖态。由于 antd QRCode 暂无 Axi UI 等价组件，
 * 保留 axi-ui-escape-hatch 注释。
 */
import React from 'react';
import { QRCode } from 'antd';
import { AxiBanner } from '@axi/widgets';
import {
  webDeviceLoginQrPayload,
  type WebDeviceLoginQr,
} from '../../../lib/webDeviceLogin';

export type DeviceQrStatus =
  | 'creating'
  | 'waiting_scan'
  | 'approved'
  | 'expired'
  | 'failed';

export interface QrLoginPanelProps {
  appName: string;
  /** t('auth.login.qrLogin') */
  qrLoginLabel: string;
  /** t('auth.login.scanTitle') */
  scanTitle: string;
  /** t('auth.login.useAccount') */
  useAccountLabel: string;
  deviceQr: WebDeviceLoginQr | null;
  deviceQrStatus: DeviceQrStatus;
  qrError: string | null;
  onRefresh: () => void;
  onUseAccount: () => void;
}

function QrLoginPanel({
  appName,
  qrLoginLabel,
  scanTitle,
  useAccountLabel,
  deviceQr,
  deviceQrStatus,
  qrError,
  onRefresh,
  onUseAccount,
}: QrLoginPanelProps) {
  const qrOverlayTitle = deviceQrStatus === 'expired' ? '二维码已过期' : '二维码加载失败';
  const qrOverlayHint = deviceQrStatus === 'expired' ? '请点击刷新' : '请点击重试';

  return (
    <section className="axi-login-qr-column" id="axi-login-qr-panel" aria-label={qrLoginLabel}>
      <h1 id="axi-login-title">{scanTitle}</h1>
      <div
        className="axi-login-qr-hover"
        title={`请使用 ${appName} 手机端扫描二维码登录`}
        aria-label={`使用 ${appName} 手机端扫描二维码登录`}
        role="img"
        tabIndex={0}
      >
        <div className={`axi-login-qr-frame ${deviceQrStatus === 'failed' || deviceQrStatus === 'expired' ? 'is-error' : ''}`}>
          {deviceQr ? (
            // axi-ui-escape-hatch: antd QRCode 在 Axi UI 尚未提供等价组件前的临时替代
            <QRCode
              aria-label="电脑登录二维码"
              value={webDeviceLoginQrPayload(deviceQr)}
              size={160}
              color="#111827"
              bgColor="#ffffff"
              errorLevel="M"
              bordered={false}
              status="active"
            />
          ) : deviceQrStatus === 'failed' ? (
            <div className="axi-login-qr-error" role="status">
              <span className="axi-login-qr-error__title">二维码暂时不可用</span>
              <button type="button" onClick={onRefresh}>重新生成</button>
            </div>
          ) : (
            <div className="axi-login-qr-loading"><span /><span /><span /></div>
          )}
          {(deviceQrStatus === 'expired' || deviceQrStatus === 'failed') && deviceQr && (
            <button
              type="button"
              className="axi-login-qr-expired-overlay"
              aria-label={`${qrOverlayTitle}，${qrOverlayHint}`}
              onClick={onRefresh}
            >
              <span className="axi-login-qr-expired-overlay__icon" aria-hidden="true" />
              <span className="axi-login-qr-expired-overlay__title">{qrOverlayTitle}</span>
              <span className="axi-login-qr-expired-overlay__hint">{qrOverlayHint}</span>
            </button>
          )}
        </div>
      </div>
      <p className="axi-login-qr-instruction">
        使用 <strong>{appName} 手机端</strong> 扫码登录
      </p>
      {qrError && deviceQrStatus === 'failed' && (
        <AxiBanner compact tone="danger" role="alert" className="axi-login-banner axi-login-banner--qr" aria-label="电脑登录二维码错误">
          {qrError}
        </AxiBanner>
      )}
      <button type="button" className="axi-login-entry-switch" onClick={onUseAccount}>
        {useAccountLabel}
      </button>
    </section>
  );
}

export default QrLoginPanel;
