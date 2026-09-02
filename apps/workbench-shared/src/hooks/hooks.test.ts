import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useDebouncedValue,
  useInterval,
  useLocalStorage,
  useThrottledValue,
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
});