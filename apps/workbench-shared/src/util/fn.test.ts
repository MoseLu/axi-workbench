import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, once, sleep, throttle } from './fn';

afterEach(() => {
  vi.useRealTimers();
});

describe('@axi/workbench-shared/util/fn', () => {
  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('only fires after the trailing edge with the latest args', () => {
      const fn = vi.fn();
      const d = debounce(fn, 100);
      d('a');
      d('b');
      d('c');
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('c');
    });

    it('cancel() discards the pending call', () => {
      const fn = vi.fn();
      const d = debounce(fn, 100);
      d('a');
      d.cancel();
      vi.advanceTimersByTime(200);
      expect(fn).not.toHaveBeenCalled();
    });

    it('flush() runs the pending call immediately', () => {
      const fn = vi.fn();
      const d = debounce(fn, 100);
      d('a');
      d.flush();
      expect(fn).toHaveBeenCalledWith('a');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('fires immediately on leading edge then coalesces subsequent', () => {
      const fn = vi.fn();
      const t = throttle(fn, 100);
      t('a');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('a');
      t('b');
      t('c');
      expect(fn).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('c');
    });

    it('cancel() discards pending trailing call', () => {
      const fn = vi.fn();
      const t = throttle(fn, 100);
      t('a');
      t('b');
      t.cancel();
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('once', () => {
    it('only invokes the wrapped function on the first call', () => {
      const fn = vi.fn().mockReturnValue('first');
      const wrapped = once(fn);
      expect(wrapped('a')).toBe('first');
      expect(wrapped('b')).toBeUndefined();
      expect(wrapped('c')).toBeUndefined();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('a');
    });
  });

  describe('sleep', () => {
    it('resolves after delay', async () => {
      vi.useFakeTimers();
      const promise = sleep(100);
      const resolved = vi.fn();
      promise.then(resolved);
      expect(resolved).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(100);
      expect(resolved).toHaveBeenCalled();
    });
  });
});