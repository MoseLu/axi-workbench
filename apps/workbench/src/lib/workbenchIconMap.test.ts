import { describe, expect, it } from 'vitest';
import {
  axiWorkbenchIconMap,
  resolveAxiWorkbenchIcon,
} from '@axi/workbench-foundation/icons';

describe('Axi Workbench account-menu icon semantics', () => {
  it('uses the established exit glyph for signing out', () => {
    expect(axiWorkbenchIconMap.logout).toBe('exit');
    expect(resolveAxiWorkbenchIcon('logout')).toBe('exit');
  });

  it('keeps plugin discovery and preferences on distinct semantic glyphs', () => {
    expect(axiWorkbenchIconMap.plugins).toBe('app');
    expect(axiWorkbenchIconMap.preferences).toBe('theme');
    expect(resolveAxiWorkbenchIcon('preferences')).toBe('theme');
  });
});
