import type React from 'react';
import { mobileDeviceRestoreMessage, useEnsureMobileDeviceSession } from '../lib/mobileControl';

/** Restores a locally paired device before protected mobile routes render. */
export function MobileDeviceSessionBootstrap({ children }: { children: React.ReactNode }) {
  const { isRestoring, restoreError, retryRestore } = useEnsureMobileDeviceSession();
  if (isRestoring) return <main className="axi-mobile-login"><p>正在恢复已配对设备…</p></main>;
  const message = mobileDeviceRestoreMessage(restoreError);
  if (message) {
    return (
      <main className="axi-mobile-login">
        <p role="alert">{message}</p>
        <button type="button" onClick={() => void retryRestore()}>重新尝试</button>
      </main>
    );
  }
  return <>{children}</>;
}
