/**
 * 展示端图片网格 - 按 PDF 分组，显示 SOP 卡片
 * - 显示第一页（拥有作业名称）作为预览图
 * - 显示"共N页"而非"第X页"
 * - 双击预览大图
 */
import React, { useState, useMemo } from 'react';
import apiClient from '../api/client';

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

interface Props {
  results?: SearchResult[];
  onSelect?: (result: SearchResult & { totalPages: number; previewPath: string; allPages: SearchResult[] }) => void;
}

export default function DisplayImageGrid({ results, onSelect }: Props) {
  const [viewer, setViewer] = useState<string | null>(null);

  // 按 PDF 分组，每组计算总页数和预览图
  const pdfGroups = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results || []) {
      const key = r.pdf_path || r.image_path || String(r.id);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.values()].map(group => {
      // 按 page_num 排序
      const sorted = [...group].sort((a, b) => (a.page_num || 0) - (b.page_num || 0));
      // 第一页（有作业名称）作为预览图
      const firstWithJob = sorted.find(r => r.job_name) || sorted[0];
      return {
        ...firstWithJob,
        totalPages: sorted.length,
        previewPath: firstWithJob.image_path || firstWithJob.image_url || '',
        allPages: sorted,
      } as SearchResult & { totalPages: number; previewPath: string; allPages: SearchResult[] };
    });
  }, [results]);

  const getImgSrc = (path: string) => {
    if (!path) return '';
    return apiClient.getImageUrl(path);
  };

  if (pdfGroups.length === 0) return null;

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16,
      }}>
        {pdfGroups.map((r, i) => (
          <div key={i}
            onClick={() => onSelect?.(r)}
            style={{
              borderRadius: 12, overflow: 'hidden',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
            }}
          >
            {/* 预览图 */}
            <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: '#1e293b' }}>
              <img
                src={getImgSrc(r.previewPath)}
                alt={r.job_name || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                onDoubleClick={() => setViewer(r.previewPath || null)}
                onClick={() => onSelect?.(r)}
              />
            </div>
            {/* 信息区 */}
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.job_name || r.pdf_name || '—'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  共 {r.totalPages} 页
                </span>
                {r.category && (
                  <span style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                    {r.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 全屏预览 */}
      {viewer && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0,
            width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.92)',
            zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setViewer(null)}
        >
          <button
            onClick={() => setViewer(null)}
            style={{
              position: 'fixed', top: 20, right: 24,
              background: 'rgba(255,255,255,0.9)', color: '#333',
              border: 'none', cursor: 'pointer', padding: 10, borderRadius: 8,
              zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconClose />
          </button>
          <img
            src={getImgSrc(viewer)}
            alt=""
            style={{ maxWidth: '96vw', maxHeight: '96vh', objectFit: 'contain' }}
            onClick={() => setViewer(null)}
          />
        </div>
      )}
    </>
  );
}
