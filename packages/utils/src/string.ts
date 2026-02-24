export function truncate(str: string, length: number, suffix = "..."): string {
  if (str.length <= length) return str
  return str.slice(0, length - suffix.length) + suffix
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function capitalizeWords(str: string): string {
  return str.split(" ").map(capitalize).join(" ")
}

export function maskEmail(email: string): string {
  const [username, domain] = email.split("@")
  if (!domain) return email
  const visibleChars = Math.min(3, Math.floor(username.length / 2))
  const masked = username.slice(0, visibleChars) + "***"
  return `${masked}@${domain}`
}

export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}
