import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import './OfflineBanner.css';

/**
 * Fixed top banner shown while the device is offline. Rendered once at the
 * App root so every route inherits the warning without per-page wiring.
 */
export const OfflineBanner: React.FC = () => {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="wb-offline-banner" role="alert" aria-live="assertive">
      网络连接已断开 — 操作可能无法保存，请检查网络后重试。
    </div>
  );
};

export default OfflineBanner;
