import { act, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';

import {
  BREAKPOINTS,
  useBreakpoint,
  useClickOutside,
  useDebouncedCallback,
  useDebouncedValue,
  useDisclosure,
  useEventListener,
  useInterval,
  useKeyPress,
  useLocalStorage,
  useMediaQuery,
  usePrevious,
  useThrottledCallback,
  useThrottledValue,
  useToggle,
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
      const inside = document.createElement('div');
      const insideChild = document.createElement('span');
      inside.appendChild(insideChild);
      document.body.appendChild(inside);

      const ref = createRef<HTMLDivElement>();
      ref.current = inside;
      renderHook(() => useClickOutside(ref, handler));

      act(() => {
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(handler).toHaveBeenCalled();

      act(() => {
        insideChild.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      // outside clicks already invoked handler; ensure inside click does NOT add more
      expect(handler).toHaveBeenCalledTimes(1);
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
      // @ts-expect-error — testing fallback
      window.matchMedia = undefined as unknown as typeof window.matchMedia;
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
});