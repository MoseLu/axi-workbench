import { useCallback, useEffect, useState } from "react";
import type { MemorySettings } from "@axi/gateway-contracts";
import { fetchMemorySettings, patchMemorySettings } from "../../memory-client";

/**
 * MEM-MVP-016 — Memory settings body.
 *
 * The body renders inside the unified `SettingsDialog`. Mount triggers
 * the initial `GET /memory/settings`; toggles call `PATCH` immediately.
 * The dialog owns the backdrop and chrome, so this component never
 * checks `open` — it is mounted only while the dialog is open.
 */

const PROJECT_ID = "ai-resource-orchestration";

interface MemorySettingsBodyProps {
  onSettingsChanged?: (settings: MemorySettings) => void;
}

const labels: Record<keyof MemorySettings, string> = {
  useMemory: "使用本地记忆",
  generateMemory: "生成新记忆",
  externalContextProtection: "外部上下文保护",
  defaultScope: "默认 scope",
  defaultProjectId: "默认 projectId",
};

export function MemorySettingsBody({ onSettingsChanged }: MemorySettingsBodyProps) {
  const [settings, setSettings] = useState<MemorySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMemorySettings().then((value) => {
      if (cancelled) return;
      if (value) {
        setSettings(value);
        onSettingsChanged?.(value);
        setError(null);
      } else {
        setError("无法读取本地记忆设置（gateway 暂不可用）。");
      }
    }).catch(() => {
      if (cancelled) return;
      setError("无法读取本地记忆设置。");
    });
    return () => { cancelled = true; };
    // The dialog only mounts this body while open, so a single fetch on
    // mount is the intended lifecycle; the parent owns refresh semantics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(async (patch: Partial<MemorySettings>) => {
    setBusy(true);
    try {
      const next = await patchMemorySettings(patch);
      if (next) {
        setSettings(next);
        onSettingsChanged?.(next);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }, [onSettingsChanged]);

  return (
    <>
      {error && <p className="memory-settings-error" role="alert">{error}</p>}
      {settings ? (
        <ul className="memory-settings-list">
          <li>
            <label>
              <input
                type="checkbox"
                checked={settings.useMemory}
                disabled={busy}
                onChange={(event) => update({ useMemory: event.target.checked })}
              />
              <span>
                <strong>{labels.useMemory}</strong>
                <em>开启后，新请求会检索本地记忆命中（默认关闭）。</em>
              </span>
            </label>
          </li>
          <li>
            <label>
              <input
                type="checkbox"
                checked={settings.generateMemory}
                disabled={busy}
                onChange={(event) => update({ generateMemory: event.target.checked })}
              />
              <span>
                <strong>{labels.generateMemory}</strong>
                <em>开启后，符合策略的会话可能产生新的记忆候选（默认关闭）。</em>
              </span>
            </label>
          </li>
          <li>
            <label>
              <input
                type="checkbox"
                checked={settings.externalContextProtection}
                disabled={busy}
                onChange={(event) => update({ externalContextProtection: event.target.checked })}
              />
              <span>
                <strong>{labels.externalContextProtection}</strong>
                <em>使用外部 provider / MCP / web 搜索时禁止生成长期记忆（默认开启）。</em>
              </span>
            </label>
          </li>
          <li>
            <label>
              <span>
                <strong>{labels.defaultScope}</strong>
                <em>默认作用范围。</em>
              </span>
              <select
                value={settings.defaultScope}
                disabled={busy}
                onChange={(event) => update({ defaultScope: event.target.value as MemorySettings["defaultScope"] })}
              >
                <option value="global">global</option>
                <option value="project">project</option>
              </select>
            </label>
          </li>
          <li>
            <label>
              <span>
                <strong>{labels.defaultProjectId}</strong>
                <em>仅服务端登记的 opaque ID；本产品下为 {PROJECT_ID}。</em>
              </span>
              <input
                type="text"
                value={settings.defaultProjectId ?? ""}
                readOnly
                aria-readonly
              />
            </label>
          </li>
        </ul>
      ) : (
        <p className="memory-settings-loading">正在读取本地记忆设置…</p>
      )}
    </>
  );
}
