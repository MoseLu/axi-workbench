import enUSLocale from "antd/locale/en_US";
import zhCNLocale from "antd/locale/zh_CN";

export type AppLocale = "zh-CN" | "en-US";

export const defaultAppLocale: AppLocale = "zh-CN";

export const appLocaleOptions: Array<{ labelKey: string; value: AppLocale }> = [
  { labelKey: "简体中文", value: "zh-CN" },
  { labelKey: "English", value: "en-US" }
];

export const antdLocaleByAppLocale = {
  "zh-CN": zhCNLocale,
  "en-US": enUSLocale
} satisfies Record<AppLocale, typeof zhCNLocale>;

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "zh-CN" || value === "en-US";
}
