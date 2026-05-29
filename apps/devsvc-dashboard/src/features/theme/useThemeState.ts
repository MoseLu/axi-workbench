import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

import { alphaHexColor, mixHexColor } from "../../lib/color";
import { primaryShadeMixTarget, themePresets, type ThemeMode, type ThemeName, type ThemePreference, type ThemePreset } from "../../theme/tokens";

const themeStorageKey = "devsvc-dashboard-theme";
const themeModeStorageKey = "devsvc-dashboard-theme-mode";

type ThemeViewTransition = {
  ready: Promise<void>;
  finished?: Promise<void>;
};
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ThemeViewTransition;
};

export function readStoredThemeName(): ThemeName {
  if (typeof window === "undefined") return "default";
  const stored = window.localStorage.getItem(themeStorageKey);
  return themePresets.some((theme) => theme.name === stored) ? (stored as ThemeName) : "default";
}

export function themeCssVariables(theme: ThemePreset) {
  const primary = theme.color;
  const primaryHover = mixHexColor(primary, primaryShadeMixTarget, 0.12);
  const primaryActive = mixHexColor(primary, primaryShadeMixTarget, 0.2);
  const primaryBorder = alphaHexColor(primary, 0.72);
  const primarySoft = alphaHexColor(primary, 0.22);
  const primarySofter = alphaHexColor(primary, 0.1);

  return {
    "--primary": primary,
    "--primary-hover": primaryHover,
    "--primary-active": primaryActive,
    "--primary-border": primaryBorder,
    "--primary-soft": primarySoft,
    "--primary-softer": primarySofter,
    "--axi-primary": primary,
    "--axi-primary-hover": primaryHover,
    "--blue": primary,
    "--blue-bg": alphaHexColor(primary, 0.14)
  };
}

export function applyThemeToElement(root: HTMLElement, theme: ThemePreset, mode: ThemeMode) {
  Object.entries(themeCssVariables(theme)).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
  root.dataset.theme = theme.name;
  root.dataset.axiTheme = theme.name;
  root.dataset.mode = mode;
  root.dataset.axiMode = mode;
  root.style.colorScheme = mode;
}

export function applyTheme(theme: ThemePreset, mode: ThemeMode) {
  if (typeof document === "undefined") return;
  applyThemeToElement(document.documentElement, theme, mode);
}

export function readStoredThemeMode(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(themeModeStorageKey);
  return stored === "light" || stored === "system" ? stored : "dark";
}

export function resolveThemeMode(preference: ThemePreference): ThemeMode {
  if (preference !== "system" || typeof window === "undefined") return preference === "light" ? "light" : "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}


export function useThemeState() {
  const [themeName, setThemeName] = useState<ThemeName>(() => readStoredThemeName());
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredThemeMode());
  const [systemMode, setSystemMode] = useState<ThemeMode>(() => resolveThemeMode("system"));
  const theme = useMemo(() => themePresets.find((item) => item.name === themeName) || themePresets[0], [themeName]);
  const mode = preference === "system" ? systemMode : preference;

  useEffect(() => {
    applyTheme(theme, mode);
    window.localStorage.setItem(themeStorageKey, theme.name);
    window.localStorage.setItem(themeModeStorageKey, preference);
  }, [theme, mode, preference]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemMode = () => setSystemMode(mediaQuery.matches ? "dark" : "light");
    updateSystemMode();
    mediaQuery.addEventListener("change", updateSystemMode);
    return () => mediaQuery.removeEventListener("change", updateSystemMode);
  }, []);

  function commitTheme(nextThemeName: ThemeName, nextPreference: ThemePreference) {
    const nextTheme = themePresets.find((item) => item.name === nextThemeName) || themePresets[0];
    const nextMode = nextPreference === "system" ? systemMode : nextPreference;
    flushSync(() => {
      setThemeName(nextTheme.name);
      setPreference(nextPreference);
    });
    applyTheme(nextTheme, nextMode);
    window.localStorage.setItem(themeStorageKey, nextTheme.name);
    window.localStorage.setItem(themeModeStorageKey, nextPreference);
  }

  function clearTransitionState() {
    const root = document.documentElement;
    delete root.dataset.themeTransition;
    root.style.removeProperty("--theme-transition-clip-start");
    root.style.removeProperty("--theme-transition-clip-end");
  }

  function runViewTransition(trigger: HTMLElement | null, nextMode: ThemeMode, callback: () => void) {
    const viewTransitionDocument = document as ViewTransitionDocument;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!trigger || !viewTransitionDocument.startViewTransition || prefersReducedMotion) {
      callback();
      return;
    }

    const root = document.documentElement;
    const rect = trigger.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const clipStart = `circle(0 at ${x}px ${y}px)`;
    const clipEnd = `circle(${endRadius}px at ${x}px ${y}px)`;
    const useOldLayer = nextMode === "dark";

    root.dataset.themeTransition = useOldLayer ? "to-dark" : "to-light";
    root.style.setProperty("--theme-transition-clip-start", clipStart);
    root.style.setProperty("--theme-transition-clip-end", clipEnd);

    const transition = viewTransitionDocument.startViewTransition(callback);
    const cleanupTimer = window.setTimeout(clearTransitionState, 700);

    transition.ready.catch(clearTransitionState);

    void transition.finished?.finally(() => {
      window.clearTimeout(cleanupTimer);
      clearTransitionState();
    });
  }

  function changeThemeName(nextThemeName: ThemeName) {
    if (nextThemeName === themeName) return;
    commitTheme(nextThemeName, preference);
  }

  function changeMode(nextPreference: ThemePreference, trigger?: HTMLElement | null) {
    if (nextPreference === preference) return;
    const nextMode = nextPreference === "system" ? systemMode : nextPreference;
    runViewTransition(trigger || null, nextMode, () => commitTheme(theme.name, nextPreference));
  }

  function toggleMode(trigger?: HTMLElement | null) {
    const nextMode = mode === "dark" ? "light" : "dark";
    runViewTransition(trigger || null, nextMode, () => commitTheme(theme.name, nextMode));
  }

  return { theme, mode, preference, changeThemeName, changeMode, toggleMode };
}
