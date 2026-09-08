import { describe, expect, it } from 'vitest';
import { toNavBadge, type NavBadgeDto } from './index';

describe('@axi/workbench-shared/types toNavBadge', () => {
  it('returns none for missing / undefined dto', () => {
    expect(toNavBadge(undefined)).toEqual({ kind: 'none' });
  });

  it('returns dot for kind=dot', () => {
    expect(toNavBadge({ kind: 'dot' })).toEqual({ kind: 'dot' });
  });

  it('returns count with positive integer value', () => {
    expect(toNavBadge({ kind: 'count', value: 5 })).toEqual({ kind: 'count', value: 5 });
  });

  it('drops count with 0 / negative / NaN value back to none', () => {
    expect(toNavBadge({ kind: 'count', value: 0 })).toEqual({ kind: 'none' });
    expect(toNavBadge({ kind: 'count', value: -3 })).toEqual({ kind: 'none' });
    expect(toNavBadge({ kind: 'count', value: Number.NaN })).toEqual({ kind: 'none' });
  });

  it('tolerates case-insensitive kind strings', () => {
    expect(toNavBadge({ kind: 'DOT' })).toEqual({ kind: 'dot' });
    expect(toNavBadge({ kind: 'Count', value: 2 })).toEqual({ kind: 'count', value: 2 });
  });

  it('returns none for unknown kinds', () => {
    expect(toNavBadge({ kind: 'unknown' as NavBadgeDto['kind'] })).toEqual({ kind: 'none' });
  });
});