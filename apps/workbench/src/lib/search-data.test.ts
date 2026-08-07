import { describe, expect, it } from 'vitest';
import { filterSearchCorpus, SEARCH_CORPUS } from './search-data';

describe('filterSearchCorpus', () => {
  it('matches titles and descriptions case-insensitively', () => {
    expect(filterSearchCorpus('mobile').map((hit) => hit.id)).toEqual(['p1']);
    expect(filterSearchCorpus('文档').map((hit) => hit.id)).toEqual(['p2', 'd1', 'd2', 'd3']);
  });

  it('returns no results for blank input and preserves route targets', () => {
    expect(filterSearchCorpus('   ')).toEqual([]);
    expect(SEARCH_CORPUS.every((hit) => hit.path.startsWith('/admin/'))).toBe(true);
  });
});
