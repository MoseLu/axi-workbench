export function normalizeLocalhostOrigin() {
  if (typeof window === "undefined") return false;
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return false;
  if (window.location.hostname !== "localhost") return false;
  const nextUrl = new URL(window.location.href);
  nextUrl.hostname = "127.0.0.1";
  window.location.replace(nextUrl.toString());
  return true;
}
