/**
 * Tests for the tab-list state helpers.
 *
 * Strategy:
 *  - The module is pure (no React, no router), so we can exercise every
 *    transition deterministically.
 *  - Fixtures use 4 - 6 tabs in different shapes (pinned in the middle,
 *    pinned at the end, all closable) to surface order-sensitive bugs.
 */

import { describe, it, expect } from 'vitest';
import {
  HOME_TAB,
  openTab,
  focusTab,
  closeTab,
  closeLeft,
  closeRight,
  closeOther,
  closeAll,
  togglePin,
  type TabItem,
} from './tabs';

const a: TabItem = { key: '/a', label: 'A', path: '/a' };
const b: TabItem = { key: '/b', label: 'B', path: '/b' };
const c: TabItem = { key: '/c', label: 'C', path: '/c' };
const d: TabItem = { key: '/d', label: 'D', path: '/d' };
const HOME: TabItem = { ...HOME_TAB };

describe('openTab', () => {
  it('appends a new closable tab and activates it', () => {
    const result = openTab([HOME], a);
    expect(result.tabs.map((t) => t.key)).toEqual([HOME.key, '/a']);
    expect(result.nextActive).toBe('/a');
    expect(result.tabs[1]?.closable).toBe(true);
  });

  it('is a no-op when the key already exists; activates it', () => {
    const result = openTab([HOME, a, b], a);
    expect(result.tabs.map((t) => t.key)).toEqual([HOME.key, '/a', '/b']);
    expect(result.nextActive).toBe('/a');
  });

  it('defaults path to key when caller omits it (admin-shell convenience)', () => {
    const result = openTab([HOME], { key: '/x', label: 'X' });
    expect(result.tabs[1]?.path).toBe('/x');
  });
});

describe('focusTab', () => {
  it('returns the active key without mutating the list', () => {
    const result = focusTab([HOME, a, b], '/b');
    expect(result.tabs).toEqual([HOME, a, b]);
    expect(result.nextActive).toBe('/b');
  });
});

describe('closeTab', () => {
  it('removes a non-active tab and keeps the active key', () => {
    const result = closeTab([HOME, a, b, c], '/a', '/b');
    expect(result.tabs.map((t) => t.key)).toEqual([HOME.key, '/b', '/c']);
    expect(result.nextActive).toBe('/b');
  });

  it('moves active to the last remaining tab when the active is closed', () => {
    const result = closeTab([HOME, a, b, c], '/a', '/a');
    // /a removed, active falls to the last remaining = /c
    expect(result.tabs.map((t) => t.key)).toEqual([HOME.key, '/b', '/c']);
    expect(result.nextActive).toBe('/c');
  });

  it('returns nextActive: null when closing the last tab', () => {
    const result = closeTab([a], '/a', '/a');
    expect(result.tabs).toEqual([]);
    expect(result.nextActive).toBeNull();
  });
});

describe('closeLeft', () => {
  it('removes every closable tab left of the active; pinned are kept', () => {
    // shape: [HOME(pinned), a, b(active), P(pinned), c]
    const P: TabItem = { key: '/P', label: 'P', path: '/P', closable: false };
    const result = closeLeft([HOME, a, b, P, c], '/b');
    expect(result.tabs.map((t) => t.key)).toEqual([HOME.key, '/b', '/P', '/c']);
    expect(result.nextActive).toBe('/b');
  });

  it('is a no-op when active is the first tab', () => {
    const result = closeLeft([HOME, a, b], HOME.key);
    expect(result.tabs.map((t) => t.key)).toEqual([HOME.key, '/a', '/b']);
  });
});

describe('closeRight', () => {
  it('removes every closable tab right of the active; pinned are kept', () => {
    const P: TabItem = { key: '/P', label: 'P', path: '/P', closable: false };
    const result = closeRight([HOME, a, b, c, P, d], '/b');
    expect(result.tabs.map((t) => t.key)).toEqual([HOME.key, '/a', '/b', '/P']);
    expect(result.nextActive).toBe('/b');
  });

  it('is a no-op when active is the last tab', () => {
    const result = closeRight([HOME, a, b], '/b');
    expect(result.tabs.map((t) => t.key)).toEqual([HOME.key, '/a', '/b']);
  });
});

describe('closeOther', () => {
  it('keeps active + every pinned tab, drops everything else', () => {
    const P: TabItem = { key: '/P', label: 'P', path: '/P', closable: false };
    const result = closeOther([HOME, a, P, b, c], '/a');
    expect(result.tabs.map((t) => t.key)).toEqual([HOME.key, '/a', '/P']);
    expect(result.nextActive).toBe('/a');
  });
});

describe('closeAll', () => {
  it('keeps pinned tabs and activates the last pinned', () => {
    const P1: TabItem = { key: '/P1', label: 'P1', path: '/P1', closable: false };
    const P2: TabItem = { key: '/P2', label: 'P2', path: '/P2', closable: false };
    // HOME is also pinned (`closable: false` by default from `HOME_TAB`), so it
    // survives closeAll alongside the two explicit pinned tabs.
    const result = closeAll([HOME, a, P1, b, P2, c]);
    expect(result.tabs.map((t) => t.key)).toEqual([HOME.key, '/P1', '/P2']);
    expect(result.nextActive).toBe('/P2');
  });

  it('returns an empty list and nextActive: null when nothing is pinned', () => {
    // Force-mark every tab as closable so the "no pinned" branch fires
    // regardless of whether `closable` is implicit or explicit on the fixture.
    const closable = <T extends TabItem>(t: T): T => ({ ...t, closable: true });
    const result = closeAll([closable(HOME), closable(a), closable(b), closable(c)]);
    expect(result.tabs).toEqual([]);
    expect(result.nextActive).toBeNull();
  });
});

describe('togglePin', () => {
  it('flips closable for the targeted key without changing order', () => {
    // Force-mark `/b` as explicitly closable so the flip direction is observable.
    const initial = [HOME, a, { ...b, closable: true as const }, c];
    const result = togglePin(initial, '/b');
    expect(result.map((t) => t.key)).toEqual([HOME.key, '/a', '/b', '/c']);
    expect(result[2]?.closable).toBe(false);
    expect(result[2]?.key).toBe('/b');

    const pinnedAgain = togglePin(result, '/b');
    expect(pinnedAgain[2]?.closable).toBe(true);
  });

  it('does not change non-targeted tabs', () => {
    const result = togglePin([HOME, a, { ...b, closable: true as const }, c], '/b');
    expect(result[1]).toEqual(a);
    expect(result[3]).toEqual(c);
  });
});
