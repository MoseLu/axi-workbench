/**
 * 搜索框组件（带语音输入）
 */
import React, { useState, useRef, useEffect, ReactNode } from 'react';
import apiClient from '../api/client';

const LISTBOX_ID = 'search-listbox';

interface SearchBoxProps {
  query: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
  suggestions: string[];
  showSuggestions: boolean;
  onSelectSuggestion: (suggestion: string) => void | Promise<unknown>;
  onClearSuggestions: () => void;
  loading: boolean;
  onShowSuggestionsChange?: (show: boolean) => void;
  enableVoice?: boolean;
  asrPort?: number;
  showClear?: boolean;
}

// 语音麦克风图标
const MicIcon = ({ active }: { active?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

export default function SearchBox({
  query, onChange, onSearch, suggestions, showSuggestions,
  onSelectSuggestion, onClearSuggestions, loading,
  onShowSuggestionsChange, enableVoice = true, asrPort,
  showClear = false,
}: SearchBoxProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isRecording, setIsRecording] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClearSuggestions();
        if (onShowSuggestionsChange) {
          onShowSuggestionsChange(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClearSuggestions, onShowSuggestionsChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClearSuggestions();
      setSelectedIndex(-1);
      if (onShowSuggestionsChange) onShowSuggestionsChange(false);
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0);
      }
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
      }
    }
    else if (e.key === 'Enter') {
      if (showSuggestions && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        onSelectSuggestion(suggestions[selectedIndex]);
        setSelectedIndex(-1);
      }
      onClearSuggestions();
      if (onShowSuggestionsChange) onShowSuggestionsChange(false);
    }
  };

  const handleFocus = () => {
    if (suggestions.length > 1 && onShowSuggestionsChange) {
      onShowSuggestionsChange(true);
    }
  };

  const highlight = (text: string): ReactNode => {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((p, i) => regex.test(p)
      ? <mark key={i} style={{ background: 'var(--accent-light)', borderRadius: 2, color: 'inherit' }}>{p}</mark>
      : p);
  };

  // ============== 语音识别 ==============
  const startVoiceRecognition = async (retryCount = 0) => {
    if (!enableVoice) return;

    // 防止重复启动
    if (mediaStreamRef.current) {
      console.log('[Voice] 麦克风已在使用中');
      return;
    }

    // 检查浏览器是否支持
    if (!navigator.mediaDevices) {
      alert('您的浏览器不支持麦克风功能，请使用 Chrome 或 Edge 浏览器');
      return;
    }
    if (!navigator.mediaDevices.getUserMedia) {
      alert('您的浏览器不支持 getUserMedia API');
      return;
    }

    console.log('[Voice] 麦克风功能检查通过，开始请求权限...');
    console.log('[Voice] navigator.mediaDevices.getUserMedia:', typeof navigator.mediaDevices.getUserMedia);

    try {
      // 检查权限状态（如果浏览器支持 Permissions API）
      // 注意：即使状态是 'denied'，也继续尝试，因为系统权限可能是授予的
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log('[Voice] 麦克风权限状态:', permissionStatus.state);
          // 即使是 'denied' 也继续尝试，getUserMedia 会做最终检查
        } catch (e) {
          // Permissions API 不支持 microphone 权限查询，继续尝试
          console.log('[Voice] Permissions API 不支持麦克风权限查询');
        }
      }

      // 获取麦克风权限（简化约束，提高兼容性）
      console.log('[Voice] 请求麦克风权限...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      console.log('[Voice] 麦克风权限获取成功');
      mediaStreamRef.current = stream;

      // 获取 API 基础 URL（用于确定 WebSocket 地址）
      const apiUrl = await apiClient.getResolvedBaseURL();
      const parsedUrl = new URL(apiUrl);
      const wsProtocol = parsedUrl.protocol === 'https:' ? 'wss' : 'ws';
      const resolvedAsrPort = asrPort ?? (parsedUrl.port ? Number(parsedUrl.port) + 1 : 8766);
      const wsUrl = `${wsProtocol}://${parsedUrl.hostname}:${resolvedAsrPort}`;

      console.log('[Voice] 连接 WebSocket:', wsUrl);

      // 连接 WebSocket
      const websocket = new WebSocket(wsUrl);
      setWs(websocket);
      wsRef.current = websocket;

      websocket.onopen = () => {
        console.log('[Voice] WebSocket 已连接');
        setIsRecording(true);
        void startAudioProcessing(stream);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Voice] 收到消息:', JSON.stringify(data));
          if (data.type === 'result' && data.text) {
            console.log('[Voice] 识别到文字:', data.text);
            onChange(data.text);
          } else if (data.type === 'error') {
            console.error('[Voice] 错误:', data.message);
          }
        } catch (e) {
          console.error('[Voice] 解析消息失败:', e);
        }
      };

      websocket.onerror = (error) => {
        console.error('[Voice] WebSocket 错误:', error);
        // 确保清理完成
        void stopVoiceRecognition();
      };

      websocket.onclose = () => {
        console.log('[Voice] WebSocket 已关闭');
        // 无论是正常关闭还是意外断开，都重置录音状态。
        // stopVoiceRecognition 内部有防重入保护（检查各 ref 是否为 null），
        // 用户主动停止录音时也会调用此函数，二次调用是安全的幂等操作。
        stopVoiceRecognition();
      };

    } catch (error) {
      console.error('[Voice] 获取麦克风失败:', error);
      const err = error as Error & { name?: string; message?: string };
      console.error('[Voice] 错误详情:', err.name, err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('麦克风权限被拒绝，请在系统设置中允许麦克风权限');
      } else if (err.name === 'NotFoundError') {
        alert('未找到麦克风设备，请确保麦克风已连接');
      } else if (err.name === 'NotReadableError') {
        // 尝试重试（最多3次）
        if (retryCount < 3) {
          console.log(`[Voice] 麦克风暂时不可用，第${retryCount + 1}次重试...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          void startVoiceRecognition(retryCount + 1);
          return;
        }
        await stopVoiceRecognition();
        alert('麦克风暂时不可用，请稍后重试。如果问题持续，请重启应用。');
      } else {
        alert('无法访问麦克风：' + (err.message || err.name || '未知错误'));
      }
    }
  };

  const startAudioProcessing = async (stream: MediaStream) => {
    try {
      console.log('[Voice] 开始音频处理...');
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      console.log('[Voice] AudioContext 实际采样率:', audioContext.sampleRate);

      const source = audioContext.createMediaStreamSource(stream);

      // 使用 ScriptProcessor（简单实现）
      const bufferSize = 4096;
      const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      source.connect(scriptProcessor);
      // 关键修复：使用静音增益节点连接到 destination，而不是直接连接。
      // 直接连接会将麦克风音频播放到扬声器，触发 Android AEC（回声消除），
      // AEC 会将麦克风输入中的"回声"（即刚播放的声音）完全消除，导致录音为静音，
      // DashScope 无法识别任何内容，输入框永远无法显示文字。
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0; // 静音输出，防止 AEC 自消除
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioContext.destination);

      scriptProcessor.onaudioprocess = (e) => {
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          // 转换为 16-bit PCM
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          currentWs.send(pcmData.buffer);
        }
      };
      console.log('[Voice] 音频处理已启动');
    } catch (error) {
      console.error('[Voice] 音频处理失败:', error);
    }
  };

  const stopVoiceRecognition = () => {
    setIsRecording(false);

    // 关闭 WebSocket
    const currentWs = wsRef.current;
    if (currentWs) {
      try {
        currentWs.send(JSON.stringify({ type: 'stop' }));
      } catch {}
      currentWs.close();
      wsRef.current = null;
      setWs(null);
    }

    // 停止音频流
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // 关闭音频上下文
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const activeDescendantId = selectedIndex >= 0 ? `search-option-${selectedIndex}` : undefined;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <svg style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="输入作业名、关键词..."
          aria-label="搜索作业"
          aria-autocomplete="list"
          aria-controls={LISTBOX_ID}
          aria-activedescendant={activeDescendantId}
          style={{
            width: '100%', height: 40, padding: enableVoice ? '0 40px 0 42px' : '0 40px 0 42px',
            fontSize: 15, border: '1px solid var(--border)', borderRadius: 8,
            outline: 'none', boxSizing: 'border-box', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            lineHeight: '40px',
          }}
        />
        {/* 清空按钮 */}
        {showClear && query && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="清空搜索内容"
            style={{
              position: 'absolute', right: enableVoice ? 52 : 12, top: 8,
              width: 24, height: 24, padding: 0,
              background: 'transparent', border: 'none',
              borderRadius: '50%', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm2.83 9.17a.75.75 0 01-1.06 1.06L8 8.06l-1.77 1.77a.75.75 0 11-1.06-1.06L6.94 7 5.17 5.23a.75.75 0 011.06-1.06L8 5.94l1.77-1.77a.75.75 0 011.06 1.06L9.06 7l1.77 1.77z"/>
            </svg>
          </button>
        )}
        {/* 语音按钮 */}
        {enableVoice && (
          <button
            type="button"
            onClick={isRecording ? stopVoiceRecognition : () => void startVoiceRecognition()}
            title={isRecording ? '点击停止录音' : '点击开始语音输入'}
            style={{
              position: 'absolute', right: 12, top: 8,
              width: 24, height: 24, padding: 0,
              background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
              border: isRecording ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
              borderRadius: '50%', cursor: 'pointer',
              color: isRecording ? 'var(--axi-danger, #ef4444)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <MicIcon active={isRecording} />
          </button>
        )}
        {loading && !isRecording && (
          <svg
            className="searchbox-spinner"
            style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-muted)' }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10"/>
          </svg>
        )}
        {isRecording && (
          <span
            style={{
              position: 'absolute', right: 72, top: 12,
              width: 8, height: 8,
              background: 'var(--axi-danger, #ef4444)', borderRadius: '50%',
              animation: 'pulse 1s infinite',
            }}
          />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          id={LISTBOX_ID}
          role="listbox"
          aria-label="搜索建议"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: '0 4px 16px var(--shadow-md)', zIndex: 1000, maxHeight: 300, overflow: 'auto',
          }}
        >
          {suggestions.map((item, idx) => (
            <div
              key={idx}
              id={`search-option-${idx}`}
              role="option"
              aria-selected={selectedIndex === idx}
              onClick={() => {
                onSelectSuggestion(item);
                setSelectedIndex(-1);
                onClearSuggestions();
                if (onShowSuggestionsChange) onShowSuggestionsChange(false);
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = selectedIndex === idx ? 'var(--bg-tertiary)' : 'transparent'; }}
              style={{
                padding: '10px 16px', cursor: 'pointer',
                background: selectedIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
              }}
            >
              {highlight(item)}
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .searchbox-spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
