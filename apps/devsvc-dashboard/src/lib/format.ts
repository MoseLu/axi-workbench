import i18n from "../i18n";

export function formatBytes(value?: number) {
  if (!value) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatUptime(ms?: number) {
  if (!ms) return "-";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return i18n.t("<1 分钟");
  if (minutes < 60) return i18n.t("{{count}} 分钟", { count: minutes });
  const hours = Math.floor(minutes / 60);
  return i18n.t("{{hours}} 小时 {{minutes}} 分钟", { hours, minutes: minutes % 60 });
}
