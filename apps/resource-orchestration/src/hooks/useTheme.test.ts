import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "./useTheme";

const STORAGE_KEY = "axi.theme";

interface MQListener {
  matches: boolean;
  cb: (event: { matches: boolean }) => void;
}

const createMatchMediaMock = () => {
  const listeners: MQListener[] = [];
  const mq = {
    matches: true,
    addEventListener: (_event: string, cb: (e: { matches: boolean }) => void) => {
      listeners.push({ matches: mq.matches, cb });
    },
    removeEventListener: (_event: string, cb: (e: { matches: boolean }) => void) => {
      const index = listeners.findIndex((entry) => entry.cb === cb);
      if (index >= 0) listeners.splice(index, 1);
    },
    setMatches: (next: boolean) => {
      mq.matches = next;
      listeners.forEach((entry) => entry.cb({ matches: next }));
    },
  };
  return mq;
};

describe("useTheme", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    document.documentElement.dataset.theme = "dark";
  });

  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    vi.restoreAllMocks();
  });

  it("defaults to dark when localStorage is empty", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe("dark");
    expect(result.current.effective).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("persists and reads back the choice from localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe("light");
    expect(result.current.effective).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("writes localStorage when setChoice is invoked", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setChoice("light");
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("follows system preference when choice is system", () => {
    const mq = createMatchMediaMock();
    // jsdom does not implement window.matchMedia; stub it directly
    // rather than spyOn (which requires an existing function property).
    vi.stubGlobal("matchMedia", () => mq);

    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setChoice("system");
    });
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => {
      mq.setMatches(false);
    });
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
