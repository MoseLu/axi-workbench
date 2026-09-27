export function formatNotificationTime(value: string, locale: string, now = Date.now()): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '';

  const elapsedSeconds = Math.round((timestamp - now) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, 'second');
  if (Math.abs(elapsedSeconds) < 3_600) return formatter.format(Math.round(elapsedSeconds / 60), 'minute');
  if (Math.abs(elapsedSeconds) < 86_400) return formatter.format(Math.round(elapsedSeconds / 3_600), 'hour');
  if (Math.abs(elapsedSeconds) < 604_800) return formatter.format(Math.round(elapsedSeconds / 86_400), 'day');

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
