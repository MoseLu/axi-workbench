/**
 * 图片网格组件 - 显示 SOP 卡片（按 PDF 分组）
 * - 合辑标题使用 pdf_name（完整文件名，不含 .pdf）
 * - 显示"共N页"而非"第X页"
 * - 单击预览：翻页查看器（左/右箭头切换）
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../api/client';

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const IconRight = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

interface ImageGridProps {
  results?: SopCardResult[];
  onSelect?: (result: SopCardResult) => void;
  selectable?: boolean;
  selected?: SopCardResult | null;
  /** 单独控制是否在选中时打开预览（默认 true） */
  previewOnSelect?: boolean;
}

export type SopCardResult = {
  id?: string | number;
  pdf_path?: string;
  image_path?: string;
  image_url?: string;
  pdf_name?: string;
  pdf_url?: string;
  job_name?: string;
  page_num?: number;
  category?: string;
  machine?: string;
  process?: string;
  similarity?: number;
  page_range?: string;
  total_pages?: number;
  allPages?: SopCardResult[];
};

function getImgSrc(path: string): string {
  if (!path) return '';
  return apiClient.getImageUrl(path);
}

export default function ImageGrid({ results, onSelect, selectable, selected, previewOnSelect = true }: ImageGridProps) {
  const [viewerCard, setViewerCard] = useState<SopCardResult | null>(null);
  const [viewerPageIdx, setViewerPageIdx] = useState(0);

  const viewerPages = viewerCard?.allPages || [];
  const currentPage = viewerPages[viewerPageIdx];

  const openViewer = useCallback((card: SopCardResult) => {
    // 始终从第一页（索引0）打开
    setViewerCard(card);
    setViewerPageIdx(0);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerCard(null);
    setViewerPageIdx(0);
  }, []);

  const prevPage = useCallback(() => {
    setViewerPageIdx(i => Math.max(0, i - 1));
  }, []);

  const nextPage = useCallback(() => {
    setViewerPageIdx(i => Math.min(viewerPages.length - 1, i + 1));
  }, [viewerPages.length]);

  // 键盘导航
  useEffect(() => {
    if (!viewerCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prevPage(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); nextPage(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewerCard, closeViewer, prevPage, nextPage]);

  const viewerContent = viewerCard && currentPage ? (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 99999, display: 'flex', flexDirection: 'column' }}
      onClick={closeViewer}
    >
      {/* 顶部栏：文件名 + 页码 + 关闭 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(0,0,0,0.6)', flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 600 }}>
          {currentPage.job_name || currentPage.pdf_name || ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            {viewerPageIdx + 1} / {viewerPages.length}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); closeViewer(); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
            <IconClose />
          </button>
        </div>
      </div>

      {/* 图片区域（点击不关闭，方便拖拽浏览） */}
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 上一张 */}
        {viewerPageIdx > 0 && (
          <button
            onClick={prevPage}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: 'white', padding: '12px 10px', borderRadius: 8, display: 'flex', zIndex: 2, transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.8)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
          >
            <IconLeft />
          </button>
        )}

        <img
          key={`${currentPage.pdf_path}-${currentPage.page_num}`}
          src={getImgSrc(currentPage.image_path || currentPage.image_url || '')}
          alt=""
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />

        {/* 下一张 */}
        {viewerPageIdx < viewerPages.length - 1 && (
          <button
            onClick={nextPage}
            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: 'white', padding: '12px 10px', borderRadius: 8, display: 'flex', zIndex: 2, transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.8)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
          >
            <IconRight />
          </button>
        )}
      </div>

      {/* 底部缩略图条（多页时显示） */}
      {viewerPages.length > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '10px 20px', background: 'rgba(0,0,0,0.6)', overflowX: 'auto', flexShrink: 0, justifyContent: 'center' }}
          onClick={(e) => e.stopPropagation()}>
          {viewerPages.map((p, idx) => (
            <div
              key={idx}
              onClick={() => setViewerPageIdx(idx)}
              style={{
                cursor: 'pointer',
                borderRadius: 4,
                overflow: 'hidden',
                border: idx === viewerPageIdx ? '2px solid var(--accent, var(--axi-primary-hover, #3b82f6))' : '2px solid transparent',
                opacity: idx === viewerPageIdx ? 1 : 0.5,
                transition: 'opacity 0.2s, border 0.2s',
                flexShrink: 0,
              }}>
              <img
                src={getImgSrc(p.image_path || p.image_url || '')}
                alt=""
                style={{ width: 48, height: 64, objectFit: 'cover', display: 'block', background: 'var(--axi-text-secondary, #333)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 14, padding: '8px 0',
        }}>
        {(results || []).map((r, i) => {
          const isSelected = selected?.pdf_path === r.pdf_path || selected?.id === r.id;
          // 缩略图：始终使用第一页（allPages[0]）
          const thumbPage = r.allPages?.[0] || r;
          return (
            <div key={i}
              onClick={() => onSelect?.(r)}
              onDoubleClick={() => previewOnSelect && openViewer(r)}
              style={{
                border: selectable && isSelected ? '3px solid var(--accent, var(--axi-primary-hover, #3b82f6))' : '2px solid var(--border)',
                borderRadius: 10, overflow: 'hidden', cursor: onSelect ? 'pointer' : 'default',
                position: 'relative', transition: 'all 0.2s',
                background: 'var(--bg-tertiary)',
                boxShadow: isSelected ? '0 4px 16px rgba(59,130,246,0.25)' : 'none',
              }}>
              {/* 缩略图（第一页） */}
              <img
                src={getImgSrc(thumbPage.image_path || thumbPage.image_url || '')}
                alt={r.job_name || r.pdf_name || ''}
                style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              {/* 多页指示器 */}
              {r.total_pages && r.total_pages > 1 && (
                <div style={{
                  position: 'absolute', bottom: 8, right: 8,
                  background: 'rgba(0,0,0,0.6)', color: 'white',
                  borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600,
                }}>
                  {r.total_pages}P
                </div>
              )}
              {/* 信息区域 */}
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.job_name || r.pdf_name || '未知作业'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {r.total_pages !== undefined ? `共 ${r.total_pages} 页` : ''}
                  </span>
                  {r.similarity !== undefined && (
                    <span style={{ fontSize: 11, color: 'var(--accent, var(--axi-primary-hover, #3b82f6))', fontWeight: 600 }}>
                      {(r.similarity * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                {r.category && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.category}{r.machine ? ` · ${r.machine}` : (r.process ? ` · ${r.process}` : '')}
                  </div>
                )}
              </div>
              {/* 已选标记 */}
              {isSelected && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'var(--accent, var(--axi-primary-hover, #3b82f6))', color: 'white',
                  borderRadius: '50%', width: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>

      {viewerContent && createPortal(viewerContent, document.body)}
    </>
  );
}
