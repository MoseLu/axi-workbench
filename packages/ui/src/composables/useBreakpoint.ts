import { useSyncExternalStore } from 'react';

/** Responsive breakpoint hook */
export function useBreakpoint(breakpoint = 768) {
  const query = `(max-width: ${breakpoint}px)`;

  return useSyncExternalStore(
    onStoreChange => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => undefined;
      }

      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener('change', onStoreChange);
      return () => mediaQuery.removeEventListener('change', onStoreChange);
    },
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
    () => false,
  );
}
