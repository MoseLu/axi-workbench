import React from 'react';

export type WorkbenchFloatingToolArrowDirection = 'down-right' | 'up-left';

/** Directional trigger glyph for the bottom-right quick-tools dock. */
export function WorkbenchFloatingToolArrow({
  direction,
}: {
  direction: WorkbenchFloatingToolArrowDirection;
}) {
  const path = direction === 'up-left'
    ? 'M12.25 12.25 3.75 3.75m0 0v5.25m0-5.25H9'
    : 'M3.75 3.75l8.5 8.5m0 0V7m0 5.25H7';

  return (
    <span className="axi-floating-tool-dock__direction-icon" data-direction={direction}>
      <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 16 16">
        <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </span>
  );
}
