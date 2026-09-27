import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentTitle, useFavicon, useMeta } from './meta';

afterEach(() => {
  document.title = '';
  document.head.querySelectorAll('link[rel*="icon"]').forEach((el) => el.remove());
  document.head.querySelectorAll('meta[name]').forEach((el) => el.remove());
});

describe('@axi/workbench-shared/format/meta', () => {
  describe('useDocumentTitle', () => {
    it('sets document.title', () => {
      renderHook(() => useDocumentTitle('Test Page'));
      expect(document.title).toBe('Test Page');
    });

    it('restores on unmount by default', () => {
      document.title = 'Original';
      const { unmount } = renderHook(() => useDocumentTitle('New'));
      expect(document.title).toBe('New');
      unmount();
      expect(document.title).toBe('Original');
    });

    it('does not restore when restoreOnUnmount is false', () => {
      document.title = 'Original';
      const { unmount } = renderHook(() => useDocumentTitle('New', { restoreOnUnmount: false }));
      expect(document.title).toBe('New');
      unmount();
      expect(document.title).toBe('New');
    });
  });

  describe('useFavicon', () => {
    it('updates existing favicon link', () => {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.setAttribute('href', '/old.png');
      document.head.appendChild(link);
      renderHook(() => useFavicon('/new.png'));
      expect(link.getAttribute('href')).toBe('/new.png');
    });

    it('creates a new favicon link if missing', () => {
      renderHook(() => useFavicon('/favicon.ico'));
      const link = document.querySelector('link[rel*="icon"]');
      expect(link?.getAttribute('href')).toBe('/favicon.ico');
    });
  });

  describe('useMeta', () => {
    it('sets a new meta tag', () => {
      renderHook(() => useMeta('description', 'Hello world'));
      const meta = document.querySelector('meta[name="description"]');
      expect(meta?.getAttribute('content')).toBe('Hello world');
    });

    it('updates existing meta tag', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', '#fff');
      document.head.appendChild(meta);
      renderHook(() => useMeta('theme-color', '#000'));
      expect(meta.getAttribute('content')).toBe('#000');
    });
  });
});