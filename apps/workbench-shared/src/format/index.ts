// 跨端共享的格式化工具占位（M14 骨架）。
// 真实实现：M15+ 把 web 端散落的 format helpers 集中到这里。

export function formatUnreadCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  if (count > 99) return '99+';
  return String(Math.trunc(count));
}

export function formatTimestamp(iso: string | Date, locale: string = 'zh-CN'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}