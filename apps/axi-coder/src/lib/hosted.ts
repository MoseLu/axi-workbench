export const isHostedApp = import.meta.env.VITE_AXI_HOSTED_APP === "1";

const rawBase = import.meta.env.VITE_AXI_APP_BASE || "/";
export const hostedBase = rawBase === "/" ? "" : rawBase.replace(/\/$/u, "");

export function stripHostedBase(pathname: string) {
  if (!hostedBase || !pathname.startsWith(`${hostedBase}/`)) return pathname;
  return pathname.slice(hostedBase.length) || "/";
}

export function toHostedPath(route: string) {
  return hostedBase ? `${hostedBase}${route}` : route;
}
