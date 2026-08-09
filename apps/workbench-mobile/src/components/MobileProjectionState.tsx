import { useNavigate } from 'react-router-dom';
import type { MobileControlError, MobileDeviceSession } from '../lib/mobileControl';

type Props = {
  session: MobileDeviceSession | null;
  isLoading: boolean;
  error: unknown;
  onRefresh: () => void;
};

function messageFor(error: unknown): string {
  const detail = error as MobileControlError | undefined;
  if (detail?.code === 'device_pairing_required') return '本设备尚未完成配对，不能读取工作区投影。';
  if (detail?.status === 403) return '当前设备没有查看此工作区的权限。';
  if (detail?.status === 401) return '设备会话已失效，请重新配对。';
  return '控制面暂时不可用，当前不展示静态样例数据。';
}

export function mobileProjectionState(session: MobileDeviceSession | null, isLoading: boolean, error: unknown): 'pairing' | 'loading' | 'error' | 'ready' {
  if (!session) return 'pairing';
  if (isLoading) return 'loading';
  if (error) return 'error';
  return 'ready';
}

/** A single truthful state for loading, no device session, authorization, and outage. */
export function MobileProjectionState({ session, isLoading, error, onRefresh }: Props) {
  const navigate = useNavigate();
  const state = mobileProjectionState(session, isLoading, error);
  if (state === 'pairing') {
    return (
      <div className="axi-mobile-projection-state" role="status">
        <strong>需要设备配对</strong>
        <p>移动端仅使用短期设备会话读取工作区，不保存访问令牌。</p>
        <button type="button" onClick={() => navigate('/me?pair=1')}>前往设备配对</button>
      </div>
    );
  }
  if (state === 'loading') return <div className="axi-mobile-projection-state" role="status">正在读取受控工作区投影…</div>;
  if (state === 'error') {
    return (
      <div className="axi-mobile-projection-state is-error" role="alert">
        <strong>无法读取工作区</strong>
        <p>{messageFor(error)}</p>
        <button type="button" onClick={onRefresh}>重新连接</button>
      </div>
    );
  }
  return null;
}

export function formatProjectionTime(value: string | null | undefined): string {
  if (!value) return '未提供更新时间';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '更新时间不可用';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp);
}
