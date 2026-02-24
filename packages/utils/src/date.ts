import dayjs, { type Dayjs, type ConfigType } from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import localizedFormat from "dayjs/plugin/localizedFormat"

dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)

export { dayjs, type Dayjs, type ConfigType }

export function formatDate(date: ConfigType, format = "YYYY-MM-DD"): string {
  return dayjs(date).format(format)
}

export function formatDateTime(date: ConfigType, format = "YYYY-MM-DD HH:mm"): string {
  return dayjs(date).format(format)
}

export function formatRelativeTime(date: ConfigType): string {
  return dayjs(date).fromNow()
}

export function isAfter(date: ConfigType, comparing: ConfigType): boolean {
  return dayjs(date).isAfter(comparing)
}

export function isBefore(date: ConfigType, comparing: ConfigType): boolean {
  return dayjs(date).isBefore(comparing)
}

export function differenceInDays(date: ConfigType, comparing: ConfigType): number {
  return dayjs(date).diff(comparing, "day")
}
