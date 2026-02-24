import { useState, useCallback } from 'react';

/** Content fullscreen hook */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(v => !v);
  }, []);

  const enterFullscreen = useCallback(() => setIsFullscreen(true), []);
  const exitFullscreen = useCallback(() => setIsFullscreen(false), []);

  return { isFullscreen, toggleFullscreen, enterFullscreen, exitFullscreen } as const;
}
