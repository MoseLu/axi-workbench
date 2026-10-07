import { describe, expect, it } from 'vitest';
import type { ConsoleCatalog } from './consoleDirectory';
import {
  consoleSearchText,
  getVisibleConsoles,
  resolveConsoleUrl,
} from './consoleDirectory';

const catalog: ConsoleCatalog = {
  schemaVersion: 1,
  generatedBy: 'test',
  consoles: [
    {
      id: 'axi-ui-gallery', projectId: 'axi-ui', title: 'Axi UI Gallery', owner: 'axi-ui', icon: 'app',
      capabilities: ['ui', 'gallery'], status: 'active' as const, visibility: 'public' as const,
      surface: 'hosted-app' as const, environments: { dev: { url: '/apps/axi-ui-gallery/' } },
      uiContract: { provider: 'axi-ui' as const, shell: 'axi-admin-shell' as const },
    },
    {
      id: 'axi-rules', projectId: 'axi-rules', title: 'Axi Rules', owner: 'axi-rules', icon: 'auth',
      capabilities: ['rules'], status: 'active' as const, visibility: 'admin' as const,
      surface: 'hosted-app' as const, environments: {},
      uiContract: { provider: 'axi-ui' as const, shell: 'axi-admin-shell' as const },
    },
  ],
};

describe('console directory', () => {
  it('filters hidden and role-restricted consoles', () => {
    expect(getVisibleConsoles(catalog, 'developer').map((entry) => entry.id)).toEqual(['axi-ui-gallery']);
    expect(getVisibleConsoles(catalog, 'admin').map((entry) => entry.id)).toEqual(['axi-rules', 'axi-ui-gallery']);
  });

  it('resolves relative URLs against the current Workbench origin', () => {
    expect(resolveConsoleUrl(catalog.consoles[0], 'dev')).toBe(`${window.location.origin}/apps/axi-ui-gallery/`);
    expect(resolveConsoleUrl(catalog.consoles[1], 'dev')).toBeNull();
  });

  it('indexes title, owner and capabilities for global search', () => {
    expect(consoleSearchText(catalog.consoles[0])).toContain('gallery');
    expect(consoleSearchText(catalog.consoles[0])).toContain('axi-ui');
  });
});
