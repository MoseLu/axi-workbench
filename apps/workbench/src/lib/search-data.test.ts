import { describe, expect, it } from 'vitest';
import { filterSearchCorpus, SEARCH_CORPUS } from './search-data';

describe('filterSearchCorpus', () => {
  it('matches source-backed navigation titles and descriptions case-insensitively', () => {
    expect(filterSearchCorpus('运行状态').map((hit) => hit.id)).toEqual(['operations']);
    expect(filterSearchCorpus('审批队列').map((hit) => hit.id)).toEqual(['workspace']);
    expect(filterSearchCorpus('工作台').map((hit) => hit.id)).toEqual(['dashboard', 'notifications']);
  });

  it('returns no results for blank input and preserves route targets', () => {
    expect(filterSearchCorpus('   ')).toEqual([]);
    expect(SEARCH_CORPUS.every((hit) => hit.path.startsWith('/admin/'))).toBe(true);
    expect(SEARCH_CORPUS.some((hit) => /项目 [ABC]|README\.md/.test(hit.title))).toBe(false);
  });
});
