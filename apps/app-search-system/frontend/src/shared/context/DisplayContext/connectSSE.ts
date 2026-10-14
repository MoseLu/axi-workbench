/**
 * connectSSE — 建立 SSE 命令订阅。
 *
 * 原 DisplayProvider 内的 connectSSE 抽到本文件。
 *
 * @param targetUuid 明确传入要使用的 UUID，不从 React state 读取，
 *                   避免 state 异步更新时序导致 UUID 不一致的问题。
 */
import type { MutableRefObject } from 'react';

import apiClient from '../../api/client';

export function startCommandStream({
  targetUuid,
  commandSourceRef,
  setConnected,
  setApiError,
  dispatch,
}: {
  targetUuid: string;
  commandSourceRef: MutableRefObject<{ stop: () => void } | null>;
  setConnected: (value: boolean) => void;
  setApiError: (value: string | null) => void;
  dispatch: (cmd: SSECommand) => void;
}): void {
  if (commandSourceRef.current) {
    commandSourceRef.current.stop();
    commandSourceRef.current = null;
  }

  console.log('[Display] 建立 SSE 连接, uuid:', targetUuid);
  const src = apiClient.createCommandSource(targetUuid, {
    onConnect: (data: unknown) => {
      setConnected(true);
      setApiError(null);
      console.log('[Display] SSE已连接', data);
    },
    onCommand: (data: SSECommand) => {
      console.log('[Display] 收到命令', data);
      dispatch(data);
    },
    onHeartbeat: () => {},
    onDisconnect: () => {
      // SSE 断开时立即更新连接状态，让 UI 如实反映
      setConnected(false);
      console.log('[Display] SSE连接断开，等待重连...');
    },
  });
  commandSourceRef.current = src;
}