import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enUS from "./locales/en-US";
import zhCN from "./locales/zh-CN";
import { defaultAppLocale, isAppLocale } from "./types";

const localeStorageKey = "devsvc-dashboard-locale";

function readInitialLocale() {
  if (typeof window === "undefined") return defaultAppLocale;
  const storedLocale = window.localStorage.getItem(localeStorageKey);
  return isAppLocale(storedLocale) ? storedLocale : defaultAppLocale;
}

void i18n
  .use(initReactI18next)
  .init({
    lng: readInitialLocale(),
    fallbackLng: defaultAppLocale,
    supportedLngs: ["zh-CN", "en-US"],
    resources: {
      "zh-CN": { translation: zhCN },
      "en-US": { translation: enUS }
    },
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    },
    returnNull: false
  });

export * from "./types";
export default i18n;
