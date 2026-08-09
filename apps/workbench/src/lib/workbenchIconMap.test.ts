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
});
