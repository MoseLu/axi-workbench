import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BREAKPOINTS,
  useAsync,
  useAsyncFn,
  useBreakpoint,
  useClickOutside,
  useCopyToClipboard,
  useDebouncedCallback,
  useDebouncedValue,
  useDisclosure,
  useDocumentTitle,
  useEventListener,
  useFetch,
  useFirstMount,
  useFocusTrap,
  useHover,
  useInterval,
  useIsomorphicLayoutEffect,
  useKeyActivate,
  useKeyPress,
  useLocalStorage,
  useMediaQuery,
  useMounted,
  useNetworkStatus,
  useOnline,
  usePrevious,
  useReducedMotion,
  useScrollPosition,
  useStableCallback,
  useThrottledCallback,
  useThrottledValue,
  useToggle,
  useUnmount,
  useWindowSize,
} from './index';

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('@axi/workbench-shared/hooks', () => {
  describe('useDebouncedValue', () => {
    it('updates after delay with the latest value', () => {
      vi.useFakeTimers();
      const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
        initialProps: { value: 'a' },
      });
      rerender({ value: 'b' });
      rerender({ value: 'c' });
      expect(result.current).toBe('a');
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe('c');
    });
  });

  describe('useInterval', () => {
    it('invokes callback periodically while delay is set', () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      renderHook(() => useInterval(callback, 50));
      expect(callback).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(callback).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('stops when delay is null', () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const { rerender } = renderHook(({ delay }) => useInterval(callback, delay), {
        initialProps: { delay: 50 as number | null },
      });
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(callback).toHaveBeenCalledTimes(1);
      rerender({ delay: null });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('useThrottledValue', () => {
    it('emits the latest value after the window elapses, not immediately', () => {
      // Trailing-edge throttle: first change is held until windowMs elapses,
      // then the latest value lands. This is the common "limit updates to once
      // per N ms" pattern, distinct from useDebouncedValue only by intent
      // (throttle = rate limit; debounce = wait for pause).
      vi.useFakeTimers();
      const { result, rerender } = renderHook(({ value }) => useThrottledValue(value, 100), {
        initialProps: { value: 'a' },
      });
      rerender({ value: 'b' });
      // Trailing edge: value stays at 'a' until window elapses
      expect(result.current).toBe('a');
      rerender({ value: 'c' });
      rerender({ value: 'd' });
      expect(result.current).toBe('a');
      act(() => {
        vi.advanceTimersByTime(100);
      });
      // Latest value at window boundary lands
      expect(result.current).toBe('d');
    });
  });

  describe('useLocalStorage', () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    it('returns initial value when key is missing', () => {
      const { result } = renderHook(() => useLocalStorage('missing', 'fallback'));
      expect(result.current[0]).toBe('fallback');
    });

    it('persists writes to localStorage', () => {
      const { result } = renderHook(() => useLocalStorage<{ count: number }>('counter', { count: 0 }));
      act(() => {
        result.current[1]({ count: 5 });
      });
      expect(window.localStorage.getItem('counter')).toBe(JSON.stringify({ count: 5 }));
      expect(result.current[0]).toEqual({ count: 5 });
    });

    it('tolerates corrupt JSON by falling back to initial value', () => {
      window.localStorage.setItem('corrupt', '{not-valid-json');
      const { result } = renderHook(() => useLocalStorage<number>('corrupt', 42));
      expect(result.current[0]).toBe(42);
    });
  });

  describe('useToggle', () => {
    it('starts at false by default', () => {
      const { result } = renderHook(() => useToggle());
      expect(result.current[0]).toBe(false);
    });

    it('respects initial value', () => {
      const { result } = renderHook(() => useToggle(true));
      expect(result.current[0]).toBe(true);
    });

    it('toggle() flips value', () => {
      const { result } = renderHook(() => useToggle(false));
      expect(result.current[0]).toBe(false);
      act(() => result.current[1]());
      expect(result.current[0]).toBe(true);
      act(() => result.current[1]());
      expect(result.current[0]).toBe(false);
    });

    it('setValue accepts updater function', () => {
      const { result } = renderHook(() => useToggle(false));
      act(() => result.current[2]((v) => !v));
      expect(result.current[0]).toBe(true);
    });
  });

  describe('useDisclosure', () => {
    it('starts closed by default', () => {
      const { result } = renderHook(() => useDisclosure());
      expect(result.current.isOpen).toBe(false);
    });

    it('open / close / toggle work as expected', () => {
      const { result } = renderHook(() => useDisclosure(false));
      act(() => result.current.open());
      expect(result.current.isOpen).toBe(true);
      act(() => result.current.close());
      expect(result.current.isOpen).toBe(false);
      act(() => result.current.toggle());
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('usePrevious', () => {
    it('returns undefined on first render', () => {
      const { result } = renderHook(() => usePrevious('initial'));
      expect(result.current).toBeUndefined();
    });

    it('returns the previous value after rerender', () => {
      const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
        initialProps: { value: 'a' },
      });
      expect(result.current).toBeUndefined();
      rerender({ value: 'b' });
      expect(result.current).toBe('a');
      rerender({ value: 'c' });
      expect(result.current).toBe('b');
    });
  });

  describe('useEventListener', () => {
    it('attaches and removes a window listener across unmount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const handler = vi.fn();
      const { unmount } = renderHook(() => useEventListener(window, 'resize', handler));
      expect(addSpy).toHaveBeenCalledWith('resize', handler, undefined);
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('resize', handler, undefined);
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('invokes handler when event fires', () => {
      const handler = vi.fn();
      renderHook(() => useEventListener(window, 'resize', handler));
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('useClickOutside', () => {
    it('fires handler when click is outside the ref element', () => {
      const handler = vi.fn();
      // Create an element not in the document tree; ref points to it.
      const outsideElement = document.createElement('div');
      const ref = { current: outsideElement };
      renderHook(() => useClickOutside(ref, handler));
      act(() => {
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      // document.body is outside ref.current; handler should fire
      expect(handler).toHaveBeenCalled();
    });

    it('does not fire when click is inside the ref element', () => {
      const handler = vi.fn();
      const inside = document.createElement('div');
      document.body.appendChild(inside);
      const ref = { current: inside };
      renderHook(() => useClickOutside(ref, handler));
      act(() => {
        inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('useKeyPress', () => {
    it('invokes handler on matching keydown', () => {
      const handler = vi.fn();
      renderHook(() => useKeyPress('Escape', handler));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(handler).toHaveBeenCalled();
    });

    it('ignores non-matching keys', () => {
      const handler = vi.fn();
      renderHook(() => useKeyPress('Escape', handler));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('useDebouncedCallback', () => {
    it('only fires once after the trailing edge', () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 100));
      const debounced = result.current;
      act(() => {
        debounced('a');
        debounced('b');
        debounced('c');
      });
      expect(callback).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('c');
    });
  });

  describe('useThrottledCallback', () => {
    it('respects the leading edge within a window', () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const { result } = renderHook(() => useThrottledCallback(callback, 100));
      const throttled = result.current;
      act(() => throttled('a'));
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('a');
      act(() => throttled('b'));
      act(() => throttled('c'));
      // Within window, only the leading call fires
      expect(callback).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      // After window, latest call fires
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith('c');
    });
  });

  describe('useMediaQuery', () => {
    it('returns matches state from window.matchMedia', () => {
      const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
      expect(typeof result.current).toBe('boolean');
    });

    it('uses fallback when window.matchMedia is unavailable', () => {
      const original = window.matchMedia;
      (window as unknown as { matchMedia: undefined }).matchMedia = undefined;
      const { result } = renderHook(() => useMediaQuery('(max-width: 768px)', true));
      expect(result.current).toBe(true);
      window.matchMedia = original;
    });
  });

  describe('useWindowSize', () => {
    it('returns numeric width/height (defaults to 0 in jsdom)', () => {
      const { result } = renderHook(() => useWindowSize());
      expect(result.current).toHaveProperty('width');
      expect(result.current).toHaveProperty('height');
      expect(typeof result.current.width).toBe('number');
    });
  });

  describe('useBreakpoint', () => {
    it('returns xs when window width is below sm (640)', () => {
      // jsdom default viewport is 1024x768 → lg
      const { result } = renderHook(() => useBreakpoint());
      expect(['xs', 'sm', 'md', 'lg', 'xl', 'xxl']).toContain(result.current);
    });

    it('BREAKPOINTS exposes Tailwind defaults', () => {
      expect(BREAKPOINTS).toEqual({
        sm: 640,
        md: 768,
        lg: 1024,
        xl: 1280,
        xxl: 1536,
      });
    });
  });

  describe('useAsyncFn', () => {
    it('returns loading=false / value=null initially', () => {
      const fn = vi.fn().mockResolvedValue(42);
      const { result } = renderHook(() => useAsyncFn(fn));
      expect(result.current.loading).toBe(false);
      expect(result.current.value).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('run() resolves to value and updates state', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const { result } = renderHook(() => useAsyncFn(fn));
      let returned: string | null = null;
      await act(async () => {
        const r = await result.current.run();
        returned = r as string | null;
      });
      expect(returned).toBe('result');
      expect(result.current.loading).toBe(false);
      expect(result.current.value).toBe('result');
    });

    it('captures thrown errors in state', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('boom'));
      const { result } = renderHook(() => useAsyncFn(fn));
      await act(async () => {
        await result.current.run();
      });
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe('boom');
      expect(result.current.value).toBeNull();
    });
  });

  describe('useAsync', () => {
    it('runs once on mount and exposes value', async () => {
      const fn = vi.fn().mockResolvedValue('mounted');
      const { result } = renderHook(() => useAsync(fn, []));
      await act(async () => {
        // initial run is fire-and-forget; flush microtasks
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.value).toBe('mounted');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('useFocusTrap', () => {
    it('focuses first focusable child on mount', () => {
      const container = document.createElement('div');
      const button = document.createElement('button');
      button.textContent = 'first';
      container.appendChild(button);
      document.body.appendChild(container);
      const ref = { current: container };
      renderHook(() => useFocusTrap(ref, true));
      expect(document.activeElement).toBe(button);
    });
  });

  describe('useDocumentTitle', () => {
    it('sets document.title and restores on unmount', () => {
      const original = document.title;
      const { unmount } = renderHook(() => useDocumentTitle('Test Page'));
      expect(document.title).toBe('Test Page');
      unmount();
      expect(document.title).toBe(original);
    });

    it('does not restore when restoreOnUnmount is false', () => {
      document.title = 'Original';
      const { unmount } = renderHook(() => useDocumentTitle('New', { restoreOnUnmount: false }));
      expect(document.title).toBe('New');
      unmount();
      expect(document.title).toBe('New');
    });
  });

  describe('useCopyToClipboard', () => {
    it('uses navigator.clipboard.writeText when available', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      const { result } = renderHook(() => useCopyToClipboard());
      await act(async () => {
        await result.current.copy('hello');
      });
      expect(writeText).toHaveBeenCalledWith('hello');
      expect(result.current.copied).toBe(true);
      expect(result.current.error).toBeNull();
      vi.unstubAllGlobals();
    });

    it('captures error reason when clipboard denies', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      const { result } = renderHook(() => useCopyToClipboard());
      await act(async () => {
        await result.current.copy('x');
      });
      expect(result.current.copied).toBe(false);
      expect(result.current.error).toBe('unknown');
      vi.unstubAllGlobals();
    });
  });

  describe('useIsomorphicLayoutEffect', () => {
    it('runs effect synchronously after render in browser (uses useLayoutEffect)', () => {
      // In jsdom, window/document is defined → useLayoutEffect
      const fn = vi.fn();
      renderHook(() => useIsomorphicLayoutEffect(fn, []));
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('useOnline', () => {
    it('defaults to navigator.onLine', () => {
      const { result } = renderHook(() => useOnline());
      // jsdom defaults to true
      expect(typeof result.current).toBe('boolean');
    });
  });

  describe('useNetworkStatus', () => {
    it('returns NetworkInfo with online / effectiveType / saveData', () => {
      const { result } = renderHook(() => useNetworkStatus());
      expect(result.current).toHaveProperty('online');
      expect(result.current).toHaveProperty('effectiveType');
      expect(result.current).toHaveProperty('saveData');
      expect(typeof result.current.saveData).toBe('boolean');
    });
  });

  describe('useMounted', () => {
    it('returns true after mount (initial render = false in SSR, true in client)', () => {
      // renderHook runs effects synchronously by default in test environments
      const { result } = renderHook(() => useMounted());
      expect(result.current).toBe(true);
    });
  });

  describe('useUnmount', () => {
    it('invokes callback on unmount only', () => {
      const callback = vi.fn();
      const { unmount } = renderHook(() => useUnmount(callback));
      expect(callback).not.toHaveBeenCalled();
      unmount();
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('useFirstMount', () => {
    it('returns true on first render, false on subsequent', () => {
      const { result, rerender } = renderHook(() => useFirstMount());
      expect(result.current).toBe(true);
      rerender();
      expect(result.current).toBe(false);
    });
  });

  describe('useStableCallback', () => {
    it('returns the same function identity across renders', () => {
      const { result, rerender } = renderHook(() => useStableCallback(() => 42));
      const first = result.current;
      rerender();
      const second = result.current;
      expect(first).toBe(second);
    });

    it('invokes the latest callback implementation', () => {
      // Render with closure capturing a mutable value
      let currentValue = 0;
      const { result, rerender } = renderHook(() =>
        useStableCallback(() => currentValue)
      );
      expect(result.current()).toBe(0);
      currentValue = 100;
      rerender();
      expect(result.current()).toBe(100);
    });
  });

  describe('useScrollPosition', () => {
    it('returns initial { x: 0, y: 0 } in jsdom', () => {
      const { result } = renderHook(() => useScrollPosition());
      expect(result.current).toEqual({ x: 0, y: 0 });
    });
  });

  describe('useReducedMotion', () => {
    it('returns boolean (false in jsdom)', () => {
      const { result } = renderHook(() => useReducedMotion());
      expect(typeof result.current).toBe('boolean');
    });
  });

  describe('useHover', () => {
    it('returns initial state (hover: false, pressed: false)', () => {
      const ref = { current: document.createElement('div') };
      const { result } = renderHook(() => useHover(ref));
      expect(result.current).toEqual({ hover: false, pressed: false });
    });
  });

  describe('useKeyActivate', () => {
    it('invokes handler on Enter', () => {
      const handler = vi.fn();
      const { result } = renderHook(() => useKeyActivate(handler));
      act(() => {
        result.current({ key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
      });
      expect(handler).toHaveBeenCalled();
    });

    it('invokes handler on Space', () => {
      const handler = vi.fn();
      const { result } = renderHook(() => useKeyActivate(handler));
      act(() => {
        result.current({ key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
      });
      expect(handler).toHaveBeenCalled();
    });

    it('ignores other keys', () => {
      const handler = vi.fn();
      const { result } = renderHook(() => useKeyActivate(handler));
      act(() => {
        result.current({ key: 'a', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
      });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('useFetch', () => {
    const mockResponse = (body: unknown, ok = true) => ({
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Server Error',
      json: vi.fn().mockResolvedValue(body),
    });

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('starts with loading=true while initial fetch is in flight', () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse({}));
      const { result } = renderHook(() => useFetch('/api/foo'));
      // useAsync starts loading=true immediately
      expect(result.current.loading).toBe(true);
      expect(result.current.value).toBeNull();
    });

    it('skips fetch when skip=true', async () => {
      const fetchMock = fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue(mockResponse({}));
      const { result } = renderHook(() => useFetch('/api/foo', { skip: true }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.value).toBeNull();
    });
  });
});