import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "dark" | "light" | "system";
export type EffectiveTheme = "dark" | "light";

export interface UseTheme {
  choice: ThemeChoice;
  effective: EffectiveTheme;
  setChoice: (next: ThemeChoice) => void;
}

const STORAGE_KEY = "axi.theme";
const DEFAULT_CHOICE: ThemeChoice = "dark";

const isThemeChoice = (value: unknown): value is ThemeChoice =>
  value === "dark" || value === "light" || value === "system";

const readInitialChoice = (): ThemeChoice => {
  if (typeof window === "undefined") return DEFAULT_CHOICE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isThemeChoice(stored)) return stored;
  } catch {
    // localStorage may throw in privacy mode — fall through.
  }
  return DEFAULT_CHOICE;
};

const readSystemPrefersDark = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

/**
 * Owns the document-level theme choice. The choice is persisted to
 * `localStorage["axi.theme"]`; when `"system"` is selected the hook
 * subscribes to `prefers-color-scheme` so the rendered theme follows
 * the OS without remounting.
 */
export const useTheme = (): UseTheme => {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readInitialChoice());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => readSystemPrefersDark());

  useEffect(() => {
    if (typeof document === "undefined") return;
    const resolved: EffectiveTheme = choice === "system"
      ? (systemPrefersDark ? "dark" : "light")
      : choice;
    document.documentElement.dataset.theme = resolved;
  }, [choice, systemPrefersDark]);

  useEffect(() => {
    if (choice !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // quota / privacy mode — silently swallow.
    }
  }, []);

  const effective: EffectiveTheme = choice === "system"
    ? (systemPrefersDark ? "dark" : "light")
    : choice;

  return { choice, effective, setChoice };
};
