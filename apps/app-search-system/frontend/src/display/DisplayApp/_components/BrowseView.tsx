/**
 * 浏览模式视图：搜索框 + 最近查看 + 结果网格
 */
import apiClient from '../../../shared/api/client';
import SearchBox from '../../../shared/components/SearchBox';
import DisplayImageGrid from '../../../shared/components/DisplayImageGrid';
import type { DisplayHistoryEntry, DisplayHistorySource } from '../../recentHistory';
import { IconBack, IconClipboard, IconPdf } from './icons';
import { buildHistoryMeta, formatHistoryTime } from '../utils';

interface BrowseViewProps {
  query: string;
  onQueryChange: (value: string) => void;
  suggestions: string[];
  showSuggestions: boolean;
  onSelectSuggestion: (suggestion: string) => Promise<SearchResult[]> | void;
  loading: boolean;
  results: SearchResult[];
  recentHistory: DisplayHistoryEntry[];
  onClearHistory: () => void;
  onOpenHistoryEntry: (entry: DisplayHistoryEntry) => void;
  onOpenSearchResult: (result: SearchResult) => void;
  onOpenPagedSop: (
    pages: SearchResult[],
    options?: {
      jobName?: string;
      pdfUrl?: string;
      pdfPath?: string;
      pdfName?: string;
      category?: string;
      machine?: string;
      process?: string;
      source?: DisplayHistorySource;
    }
  ) => boolean;
  onBack: () => void;
}

export default function BrowseView({
  query,
  onQueryChange,
  suggestions,
  showSuggestions,
  onSelectSuggestion,
  loading,
  results,
  recentHistory,
  onClearHistory,
  onOpenHistoryEntry,
  onOpenSearchResult,
  onOpenPagedSop,
  onBack,
}: BrowseViewProps) {
  const shouldShowRecentHistory = !query.trim() || (!loading && results.length === 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: 'var(--axi-bg-page, #0d1117)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 24px',
        background: 'var(--axi-text, #1e293b)', flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            height: 40, padding: '0 16px', cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
            background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 14,
            flexShrink: 0,
          }}
        >
          <IconBack /> 返回
        </button>
        <div style={{ flex: 1 }}>
          <SearchBox
            query={query}
            onChange={onQueryChange}
            suggestions={suggestions}
            showSuggestions={showSuggestions}
            onSelectSuggestion={async (s) => {
                const searchResults = await onSelectSuggestion(s);
                if (searchResults && searchResults.length > 0) {
                  const first = searchResults[0];
                  const groupedResults = first?.pdf_path
                    ? searchResults.filter(item => item.pdf_path === first.pdf_path)
                    : searchResults;

                  if (groupedResults.some(item => item.image_url || item.image_path)) {
                    onOpenPagedSop(groupedResults, {
                      jobName: first?.job_name || first?.pdf_name || s,
                      pdfUrl: first?.pdf_url,
                      pdfPath: first?.pdf_path,
                      pdfName: first?.pdf_name,
                      category: first?.category,
                      machine: first?.machine,
                      process: first?.process,
                    });
                  } else if (first) {
                    await onOpenSearchResult(first);
                  }
                }
            }}
            onClearSuggestions={() => {}}
            onShowSuggestionsChange={() => {}}
            loading={loading}
            enableVoice={true}
            asrPort={8766}
            showClear={true}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {shouldShowRecentHistory && recentHistory.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <div>
                <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>最近查看</div>
                <div style={{ color: 'var(--axi-text-muted, #64748b)', fontSize: 13, marginTop: 4 }}>
                  直接重开之前显示过的 SOP，不用重新搜索
                </div>
              </div>
              <button
                type="button"
                onClick={onClearHistory}
                style={{
                  padding: '8px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--axi-text-secondary, #cbd5e1)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                清空记录
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}>
              {recentHistory.map(entry => {
                const metaText = buildHistoryMeta(entry);
                const previewSrc = entry.previewPath ? apiClient.getImageUrl(entry.previewPath) : '';
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => { void onOpenHistoryEntry(entry); }}
                    style={{
                      padding: 0,
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      position: 'relative',
                      aspectRatio: '3 / 4',
                      background: 'var(--axi-text, #111827)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {previewSrc ? (
                        <img
                          src={previewSrc}
                          alt={entry.jobName || entry.pdfName || 'SOP'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <IconPdf />
                      )}
                      <div style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: 'rgba(15,23,42,0.78)',
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {entry.pageCount > 0 ? `共 ${entry.pageCount} 页` : 'PDF'}
                      </div>
                    </div>
                    <div style={{ padding: '14px 14px 12px' }}>
                      <div style={{
                        color: 'white',
                        fontSize: 15,
                        fontWeight: 600,
                        lineHeight: 1.35,
                        minHeight: 40,
                        marginBottom: 8,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {entry.jobName || entry.pdfName || '未命名 SOP'}
                      </div>
                      <div style={{
                        color: 'var(--axi-text-muted, #94a3b8)',
                        fontSize: 12,
                        minHeight: 18,
                        marginBottom: 10,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {metaText || '历史缓存记录'}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: 'var(--axi-text-muted, #64748b)',
                        fontSize: 12,
                      }}>
                        <span>{formatHistoryTime(entry.viewedAt)}</span>
                        <span>
                          {entry.source === 'push' ? '中控推送' : entry.source === 'history' ? '最近打开' : '手动浏览'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {results.length > 0 ? (
          <>
            <div style={{ color: 'var(--axi-text-muted, #64748b)', marginBottom: 20, fontSize: 14 }}>
              找到 <strong style={{ color: 'var(--axi-text-muted, #94a3b8)' }}>{results.length}</strong> 个页面，
              按 PDF 合并为 <strong style={{ color: 'var(--axi-text-muted, #94a3b8)' }}>
                {[...new Set(results.map(r => r.pdf_path || r.image_path))].length}
              </strong> 个 SOP
            </div>
            <DisplayImageGrid
              results={results}
              onSelect={(r) => { void onOpenSearchResult(r); }}
            />
          </>
        ) : !loading && query ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '60vh', color: 'var(--axi-text-muted, #94a3b8)', textAlign: 'center',
          }}>
            <div style={{ opacity: 0.4, marginBottom: 16 }}><IconClipboard /></div>
            <p style={{ fontSize: 16 }}>未找到匹配结果</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>尝试其他关键词</p>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '60vh', color: 'var(--axi-text-muted, #94a3b8)', textAlign: 'center',
          }}>
            <div style={{ opacity: 0.4, marginBottom: 16 }}><IconClipboard /></div>
            <p style={{ fontSize: 16 }}>输入关键词搜索 SOP</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>支持作业名、序号等关键词</p>
          </div>
        )}
      </div>
    </div>
  );
}
