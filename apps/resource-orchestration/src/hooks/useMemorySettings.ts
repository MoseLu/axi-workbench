import { useCallback, useEffect, useRef, useState } from "react";
import type { MemorySettings } from "@axi/gateway-contracts";
import { fetchMemorySettings, patchMemorySettings } from "../memory-client";

const DEFAULT_SETTINGS: MemorySettings = {
  useMemory: false,
  generateMemory: false,
  externalContextProtection: true,
  defaultScope: "global",
};

/**
 * MEM-MVP-014 / MEM-MVP-016 — workbench memory settings hook.
 *
 * Loads the user-controlled settings from the gateway once on mount
 * and exposes a stable `useMemory` flag that the workbench can read
 * to decide whether to inject a planner context. The default is OFF
 * (matches `defaultMemorySettings()` and TODO-MEMORY-MVP.md §3).
 *
 * If the gateway is unreachable the hook falls back to the default
 * settings; it never throws into the React tree.
 */

export interface UseMemorySettings {
  settings: MemorySettings;
  loaded: boolean;
  refresh: () => Promise<void>;
  ensureLoaded: () => Promise<MemorySettings>;
  update: (patch: Partial<MemorySettings>) => Promise<void>;
  apply: (settings: MemorySettings) => void;
}

export const useMemorySettings = (options: { autoFetch?: boolean } = {}): UseMemorySettings => {
  const [settings, setSettings] = useState<MemorySettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const settingsRef = useRef<MemorySettings>(DEFAULT_SETTINGS);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const apply = useCallback((value: MemorySettings) => {
    settingsRef.current = value;
    setSettings(value);
    setLoaded(true);
  }, []);

  const refresh = useCallback(() => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const request = fetchMemorySettings().then((value) => {
      if (value) apply(value);
      setLoaded(true);
    }).catch(() => {
      // Memory is optional; an unavailable gateway keeps the default-off
      // settings and must not break the workbench.
      setLoaded(true);
    });
    refreshInFlightRef.current = request;
    void request.finally(() => {
      if (refreshInFlightRef.current === request) refreshInFlightRef.current = null;
    });
    return request;
  }, [apply]);

  const update = useCallback(async (patch: Partial<MemorySettings>) => {
    const next = await patchMemorySettings(patch);
    if (next) apply(next);
  }, [apply]);

  const ensureLoaded = useCallback(async (): Promise<MemorySettings> => {
    if (!loaded) await refresh();
    return settingsRef.current;
  }, [loaded, refresh]);

  useEffect(() => {
    if (!options.autoFetch) return;
    void refresh();
  }, [options.autoFetch, refresh]);

  return { settings, loaded, refresh, ensureLoaded, update, apply };
};
