import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, LoaderCircle } from "lucide-react";

import { frameRouteForVisibleRoute, startHostedApp, type HostedApp } from "./hostedApps";
import { canUseNativeWebviews, closeHostedWebview, syncHostedWebview } from "./hostedWebviews";
import { applyThemeToElement } from "../theme/useThemeState";
import type { ThemeMode, ThemePreference, ThemePreset } from "../../theme/tokens";

type HostedAppThemeState = {
  mode: ThemeMode;
  preference: ThemePreference;
  theme: ThemePreset;
};

type HostedAppThemePayload = {
  color: string;
  hostPreference: ThemePreference;
  mode: ThemeMode;
  preference: ThemeMode;
  preset: ThemePreset;
  presetName: string;
  source: "axi-dashboard";
  theme: string;
  themeName: string;
};

const hostThemeEventName = "axi:host-theme-change";

function hostedThemePayload(themeState: HostedAppThemeState): HostedAppThemePayload {
  return {
    color: themeState.theme.color,
    hostPreference: themeState.preference,
    mode: themeState.mode,
    preference: themeState.mode,
    preset: themeState.theme,
    presetName: themeState.theme.name,
    source: "axi-dashboard",
    theme: themeState.theme.name,
    themeName: themeState.theme.name
  };
}

function themeStorageNamespaces(appId: string) {
  return Array.from(new Set(["axi", appId, appId ? `${appId}-dashboard` : ""].filter(Boolean)));
}

function writeHostedThemeStorage(storage: Storage, appId: string, payload: HostedAppThemePayload) {
  for (const namespace of themeStorageNamespaces(appId)) {
    storage.setItem(`${namespace}.theme.mode`, payload.mode);
    storage.setItem(`${namespace}.theme.preset`, payload.presetName);
  }
}

export function HostedAppPage({ mode, preference, theme }: HostedAppThemeState) {
  const { t } = useTranslation();
  const location = useLocation();
  const { appId = "" } = useParams();
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [app, setApp] = useState<HostedApp | null>(null);
  const [error, setError] = useState("");
  const visibleRoute = `${location.pathname}${location.search}${location.hash}`;
  const frameRoute = useMemo(() => frameRouteForVisibleRoute(visibleRoute), [visibleRoute]);
  const themePayload = useMemo(() => hostedThemePayload({ mode, preference, theme }), [mode, preference, theme]);
  const nativeWebviewsAvailable = canUseNativeWebviews();
  const useNativeWebview = nativeWebviewsAvailable && app?.nativeFallback === true;
  const showIframe = !nativeWebviewsAvailable || app?.nativeFallback === false;

  const syncIframeTheme = useCallback(() => {
    if (!appId) return;
    writeHostedThemeStorage(window.localStorage, appId, themePayload);

    const frameWindow = frameRef.current?.contentWindow;
    if (!frameWindow) return;

    try {
      writeHostedThemeStorage(frameWindow.localStorage, appId, themePayload);
      applyThemeToElement(frameWindow.document.documentElement, theme, mode);
      frameWindow.document.documentElement.dataset.axiHostTheme = "1";
      const CustomEventConstructor = (frameWindow as Window & typeof globalThis).CustomEvent;
      frameWindow.dispatchEvent(new CustomEventConstructor(hostThemeEventName, { detail: themePayload }));
      frameWindow.postMessage({ payload: themePayload, type: hostThemeEventName }, window.location.origin);
    } catch {
      frameWindow.postMessage({ payload: themePayload, type: hostThemeEventName }, window.location.origin);
    }
  }, [appId, mode, theme, themePayload]);

  useEffect(() => {
    syncIframeTheme();
  }, [syncIframeTheme, showIframe, frameRoute]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setApp((current) => current && current.appId === appId ? { ...current, status: "starting" } : current);
    void startHostedApp(appId)
      .then((nextApp) => {
        if (!cancelled) setApp(nextApp);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [appId]);

  useEffect(() => {
    if (!app || app.status !== "ready" || !nativeWebviewsAvailable || app.nativeFallback) return;
    void closeHostedWebview(appId).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }, [app, appId, nativeWebviewsAvailable]);

  useEffect(() => {
    if (!app || app.status !== "ready" || !useNativeWebview || !hostRef.current) return;
    const host = hostRef.current;
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      void syncHostedWebview(appId, frameRoute, host.getBoundingClientRect()).catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    };
    const observer = new ResizeObserver(sync);
    observer.observe(host);
    sync();
    window.addEventListener("resize", sync);
    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", sync);
      void closeHostedWebview(appId);
    };
  }, [app, appId, frameRoute, useNativeWebview]);

  if (error) {
    return (
      <div className="hosted-app-state is-error">
        <AlertCircle size={18} />
        <strong>{t("应用无法启动")}</strong>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="hosted-app-frame-wrap" ref={hostRef}>
      {app?.executionBoundary ? (
        <aside className="hosted-app-boundary" aria-label="专业工具执行边界">
          <strong>执行权归属：{app.executionBoundary.owner}</strong>
          <span>授权：{app.executionBoundary.authorization}</span>
          <span>审计：{app.executionBoundary.audit}</span>
          <span>回退：{app.executionBoundary.fallback}</span>
        </aside>
      ) : null}
      {!app || app.status === "starting" ? (
        <div className="hosted-app-state">
          <LoaderCircle className="hosted-app-spinner" size={18} />
          <span>{t("应用启动中...")}</span>
        </div>
      ) : null}
      {showIframe ? (
        <iframe
          className="hosted-app-frame"
          data-app-id={appId}
          key={frameRoute}
          ref={frameRef}
          src={frameRoute}
          title={app?.title || appId}
          onLoad={syncIframeTheme}
        />
      ) : null}
    </div>
  );
}
