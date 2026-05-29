import { useEffect, useState } from "react";

import i18n, { defaultAppLocale, isAppLocale, type AppLocale } from "../i18n";

export type MenuLayout = "vertical" | "horizontal" | "mixed" | "dual";
export type MenuStyle = "design" | "dark" | "light";
export type BoxStyle = "border" | "shadow";
export type ContainerWidth = "full" | "fixed";
export type TabStyle = "default" | "card" | "google";
export type PageTransition = "none" | "fade" | "slide-left" | "slide-bottom" | "slide-top";

export type AppSettings = {
  menuLayout: MenuLayout;
  menuStyle: MenuStyle;
  boxStyle: BoxStyle;
  containerWidth: ContainerWidth;
  multiTab: boolean;
  accordion: boolean;
  collapseButton: boolean;
  quickEntry: boolean;
  reloadButton: boolean;
  breadcrumb: boolean;
  language: boolean;
  progressBar: boolean;
  colorWeak: boolean;
  watermark: boolean;
  menuWidth: number;
  tabStyle: TabStyle;
  pageTransition: PageTransition;
  radius: number;
};

const settingsStorageKey = "devsvc-dashboard-settings";
const localeStorageKey = "devsvc-dashboard-locale";

export const menuLayoutOptions: Array<{ label: string; value: MenuLayout }> = [
  { label: "垂直", value: "vertical" },
  { label: "横向", value: "horizontal" },
  { label: "混合", value: "mixed" },
  { label: "双列", value: "dual" }
];

export const defaultSettings: AppSettings = {
  menuLayout: "vertical",
  menuStyle: "design",
  boxStyle: "border",
  containerWidth: "full",
  multiTab: true,
  accordion: true,
  collapseButton: true,
  quickEntry: true,
  reloadButton: true,
  breadcrumb: true,
  language: true,
  progressBar: false,
  colorWeak: false,
  watermark: false,
  menuWidth: 230,
  tabStyle: "default",
  pageTransition: "slide-left",
  radius: 0.75
};

function readStoredSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const stored = JSON.parse(window.localStorage.getItem(settingsStorageKey) || "{}") as Partial<AppSettings>;
    const storedMenuLayout: MenuLayout =
      stored.menuLayout && menuLayoutOptions.some((item) => item.value === stored.menuLayout) ? stored.menuLayout : defaultSettings.menuLayout;
    return {
      ...defaultSettings,
      ...stored,
      menuLayout: storedMenuLayout,
      menuWidth: Math.max(180, Math.min(320, Number(stored.menuWidth) || defaultSettings.menuWidth)),
      radius: [0, 0.25, 0.5, 0.75, 1].includes(Number(stored.radius)) ? Number(stored.radius) : defaultSettings.radius
    };
  } catch {
    return defaultSettings;
  }
}

function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") return defaultAppLocale;
  const storedLocale = window.localStorage.getItem(localeStorageKey);
  return isAppLocale(storedLocale) ? storedLocale : defaultAppLocale;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => readStoredSettings());
  const [locale, setLocale] = useState<AppLocale>(() => readStoredLocale());

  useEffect(() => {
    const root = document.documentElement;
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
    root.style.setProperty("--sidebar-width", `${settings.menuWidth}px`);
    root.style.setProperty("--app-radius", `${settings.radius}rem`);
    root.dataset.boxStyle = settings.boxStyle;
    root.dataset.containerWidth = settings.containerWidth;
    root.dataset.menuStyle = settings.menuStyle;
    root.dataset.colorWeak = settings.colorWeak ? "true" : "false";
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(localeStorageKey, locale);
    document.documentElement.lang = locale;
    void i18n.changeLanguage(locale).then(() => {
      document.title = i18n.t("Axi DevSvc Dashboard");
    });
  }, [locale]);

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return { locale, settings, setLocale, updateSetting };
}
