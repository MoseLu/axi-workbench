import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../shared/api/client';
import { useDisplay } from '../shared/context/DisplayContext';
import {
  clearLastSuccessfulApiBaseURL,
  clearUserDefinedApiBaseURL,
  getLastSuccessfulApiBaseURL,
  getUserDefinedApiBaseURL,
  markManualBackendResolved,
  normalizeApiBaseURL,
  setUserDefinedApiBaseURL,
  type BackendDiscoverySource,
} from '../shared/api/discovery';

interface ConnectionSettingsPageProps {
  onBack: () => void;
}

interface ProbeResult {
  canonicalBaseURL: string;
  service?: string;
}

async function probeBackend(baseURL: string): Promise<ProbeResult> {
  const normalized = normalizeApiBaseURL(baseURL);
  if (!normalized) {
    throw new Error('请输入有效的后端地址');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${normalized}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`连接失败: HTTP ${response.status}`);
    }

    const payload = await response.json().catch(() => null) as
      | { service?: string; base_urls?: string[] }
      | null;

    if (payload?.service && payload.service !== 'sop-server') {
      throw new Error('目标地址不是 SOP 后端');
    }

    return {
      canonicalBaseURL: normalizeApiBaseURL(
        Array.isArray(payload?.base_urls) && payload.base_urls[0]
          ? payload.base_urls[0]
          : normalized,
      ),
      service: payload?.service,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('连接超时，请检查地址或网络');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getSourceLabel(source: BackendDiscoverySource): string {
  switch (source) {
    case 'auto_hostname': return 'dxu';
    case 'auto_fixed_ip': return '固定IP';
    case 'auto_scan': return '网段扫描';
    case 'manual': return '手动';
    default: return '未知';
  }
}

function StatusBadge({ phase, autoResolved, source }: {
  phase: string;
  autoResolved: boolean;
  source: BackendDiscoverySource;
}) {
  const bg = autoResolved
    ? 'rgba(34,197,94,0.15)'
    : phase === 'probing'
      ? 'rgba(59,130,246,0.15)'
      : 'rgba(248,113,113,0.15)';
  const color = autoResolved ? 'var(--axi-success, #4ade80)' : phase === 'probing' ? 'var(--axi-primary, #93c5fd)' : 'var(--axi-danger, #fca5a5)';
  const text = autoResolved
    ? `已连接 · ${getSourceLabel(source)}`
    : phase === 'probing'
      ? '连接中...'
      : '未连接';

  return (
    <span style={{
      padding: '4px 12px',
      borderRadius: 20,
      background: bg,
      color,
      fontSize: 13,
      fontWeight: 600,
    }}>
      {text}
    </span>
  );
}

export default function ConnectionSettingsPage({ onBack }: ConnectionSettingsPageProps) {
  const { backendBaseURL, backendDiscovery, refreshBackendConnection } = useDisplay();
  const [inputValue, setInputValue] = useState(() => getUserDefinedApiBaseURL());
  const [savedManualUrl, setSavedManualUrl] = useState(() => getUserDefinedApiBaseURL());
  const [lastSuccessfulUrl, setLastSuccessfulUrl] = useState(() => getLastSuccessfulApiBaseURL());
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<'neutral' | 'success' | 'error'>('neutral');

  const normalizedInput = useMemo(() => normalizeApiBaseURL(inputValue), [inputValue]);
  const manualEditEnabled = backendDiscovery.manualAllowed;
  const backendAddress = backendBaseURL || backendDiscovery.baseURL || lastSuccessfulUrl || '';

  useEffect(() => {
    setSavedManualUrl(getUserDefinedApiBaseURL());
    setLastSuccessfulUrl(getLastSuccessfulApiBaseURL());
  }, [backendAddress, backendDiscovery.phase, backendDiscovery.source]);

  const refreshStoredUrls = () => {
    setSavedManualUrl(getUserDefinedApiBaseURL());
    setLastSuccessfulUrl(getLastSuccessfulApiBaseURL());
  };

  const handleTest = async () => {
    if (!manualEditEnabled) return;
    const candidate = normalizedInput || savedManualUrl;
    if (!candidate) {
      setFeedbackState('请输入后端地址', 'error');
      return;
    }
    setTesting(true);
    setFeedbackState('', 'neutral');
    try {
      const result = await probeBackend(candidate);
      setFeedbackState(`连接成功: ${result.canonicalBaseURL}`, 'success');
      setLastSuccessfulUrl(result.canonicalBaseURL);
    } catch (error) {
      setFeedbackState((error as Error).message || '连接失败', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!manualEditEnabled || !normalizedInput) return;
    setSaving(true);
    setFeedbackState('', 'neutral');
    try {
      const result = await probeBackend(normalizedInput);
      setUserDefinedApiBaseURL(result.canonicalBaseURL);
      markManualBackendResolved(result.canonicalBaseURL);
      apiClient.applyResolvedBaseURL(result.canonicalBaseURL);
      setInputValue(result.canonicalBaseURL);
      refreshStoredUrls();
      setFeedbackState(`已保存: ${result.canonicalBaseURL}`, 'success');
    } catch (error) {
      setFeedbackState((error as Error).message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!manualEditEnabled) return;
    setSaving(true);
    setFeedbackState('', 'neutral');
    clearUserDefinedApiBaseURL();
    clearLastSuccessfulApiBaseURL();
    apiClient.reloadConfig();
    setInputValue('');
    refreshStoredUrls();
    try {
      const resolvedBaseURL = await refreshBackendConnection(true);
      setFeedbackState(`已恢复自动: ${resolvedBaseURL}`, 'success');
    } catch {
      setFeedbackState('自动回退未命中', 'neutral');
    } finally {
      setSaving(false);
    }
  };

  const setFeedbackState = (message: string, tone: 'neutral' | 'success' | 'error') => {
    setFeedback(message);
    setFeedbackTone(tone);
  };

  const feedbackStyle = feedback ? {
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    background:
      feedbackTone === 'success' ? 'rgba(34,197,94,0.16)'
        : feedbackTone === 'error' ? 'rgba(239,68,68,0.16)'
          : 'rgba(255,255,255,0.08)',
    border:
      feedbackTone === 'success' ? '1px solid rgba(34,197,94,0.35)'
        : feedbackTone === 'error' ? '1px solid rgba(239,68,68,0.35)'
          : '1px solid rgba(255,255,255,0.08)',
    color:
      feedbackTone === 'success' ? 'var(--axi-success-bg, #bbf7d0)'
        : feedbackTone === 'error' ? 'var(--axi-danger-bg, #fecaca)'
          : 'var(--axi-text, #e2e8f0)',
  } : null;

  return (
    <div style={{
      height: '100vh',
      background: 'var(--axi-bg-page, #0d1117)',
      color: 'white',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 顶部栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>连接设置</span>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.08)',
            color: 'white',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          返回
        </button>
      </div>

      {/* 内容区 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* 当前状态 */}
        <div style={{
          padding: '12px 14px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--axi-text-muted, #94a3b8)' }}>当前后端</span>
            <StatusBadge
              phase={backendDiscovery.phase}
              autoResolved={backendDiscovery.autoResolved}
              source={backendDiscovery.source}
            />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 14, color: 'var(--axi-text, #f8fafc)' }}>
            {backendAddress || '—'}
          </div>
        </div>

        {/* 手动输入区（仅自动回退全部失败时显示） */}
        {manualEditEnabled && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <span style={{ fontSize: 13, color: 'var(--axi-warning, #f59e0b)' }}>自动回退均未命中，请手动输入后端地址</span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="如 10.80.8.207:8765"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.06)',
                color: 'white',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(59,130,246,0.5)',
                  background: testing ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.2)',
                  color: 'white',
                  cursor: testing ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                }}
              >
                {testing ? '测试中...' : '测试'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!normalizedInput || saving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(34,197,94,0.5)',
                  background: !normalizedInput || saving ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.2)',
                  color: 'white',
                  cursor: !normalizedInput || saving ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                }}
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => { void handleClear(); }}
                disabled={saving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(248,113,113,0.45)',
                  background: 'rgba(248,113,113,0.14)',
                  color: 'var(--axi-danger-bg, #fecaca)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                }}
              >
                恢复自动
              </button>
            </div>
            {feedback && feedbackStyle && <div style={feedbackStyle}>{feedback}</div>}
          </div>
        )}

        {/* 记录 */}
        {(savedManualUrl || lastSuccessfulUrl) && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'grid',
            gap: 6,
            fontSize: 12,
            color: 'var(--axi-text-muted, #64748b)',
          }}>
            {savedManualUrl && (
              <div>手动地址: <span style={{ fontFamily: 'monospace', color: 'var(--axi-text-muted, #94a3b8)' }}>{savedManualUrl}</span></div>
            )}
            {lastSuccessfulUrl && (
              <div>最近成功: <span style={{ fontFamily: 'monospace', color: 'var(--axi-text-muted, #94a3b8)' }}>{lastSuccessfulUrl}</span></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
