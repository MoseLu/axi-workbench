import "@testing-library/jest-dom/vitest";

// Ant Design's scroll locker asks for pseudo-element styles when mounting the
// shared Axi drawer. jsdom logs that API as not implemented; the drawer only
// needs the computed dimensions, so ignore the pseudo-element argument here.
const nativeGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((element: Element, pseudoElement?: string | null) =>
  nativeGetComputedStyle(element, pseudoElement ? undefined : pseudoElement)) as typeof window.getComputedStyle;
