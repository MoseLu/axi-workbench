export function hexToRgb(color: string) {
  const normalized = color.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

export function toHex(value: number) {
  return Math.round(value).toString(16).padStart(2, "0");
}

export function mixHexColor(color1: string, color2: string, weight: number) {
  const safeWeight = Math.max(Math.min(Number(weight), 1), 0);
  const first = hexToRgb(color1);
  const second = hexToRgb(color2);
  return `#${toHex(first.r * (1 - safeWeight) + second.r * safeWeight)}${toHex(first.g * (1 - safeWeight) + second.g * safeWeight)}${toHex(
    first.b * (1 - safeWeight) + second.b * safeWeight
  )}`;
}

export function alphaHexColor(color: string, alpha: number) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
