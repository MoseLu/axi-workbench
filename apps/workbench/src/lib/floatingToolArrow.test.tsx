import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WorkbenchFloatingToolArrow } from './floatingToolArrow';

describe('WorkbenchFloatingToolArrow', () => {
  it('renders the symmetric up-left arrow for the collapsed dock', () => {
    const html = renderToStaticMarkup(<WorkbenchFloatingToolArrow direction="up-left" />);
    expect(html).toContain('data-direction="up-left"');
    expect(html).toContain('M12.25 12.25 3.75 3.75');
  });

  it('renders the symmetric down-right arrow for the expanded dock', () => {
    const html = renderToStaticMarkup(<WorkbenchFloatingToolArrow direction="down-right" />);
    expect(html).toContain('data-direction="down-right"');
    expect(html).toContain('M3.75 3.75l8.5 8.5');
  });
});
