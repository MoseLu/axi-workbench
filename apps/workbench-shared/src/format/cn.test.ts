import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('@axi/workbench-shared/format/cn', () => {
  it('joins truthy string segments with single spaces', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values (false, null, undefined, empty string)', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('treats numeric 0 as a truthy segment', () => {
    expect(cn('count', 0)).toBe('count 0');
  });

  it('expands object segments by truthy keys', () => {
    expect(cn('btn', { 'is-active': true, 'is-disabled': false, 'is-loading': null })).toBe('btn is-active');
  });

  it('mixes strings and objects in any order', () => {
    expect(cn('base', isEven(4) && 'even', { primary: true, secondary: undefined })).toBe('base even primary');
  });

  it('returns empty string when nothing is truthy', () => {
    expect(cn(false, null, undefined, '')).toBe('');
  });
});

// Tiny helper for the mixed test
function isEven(n: number): boolean {
  return n % 2 === 0;
}