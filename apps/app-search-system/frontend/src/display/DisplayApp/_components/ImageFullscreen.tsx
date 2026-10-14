/**
 * 图片全屏展示（浏览模式预览，支持多页翻页）
 */
import React, { useRef } from 'react';
import apiClient from '../../../shared/api/client';
import { IconPrev, IconNext } from './icons';

interface ImageFullscreenProps {
  currentImage: string;
  jobName: string | null;
  pages: SearchResult[];
  pageIndex: number;
  setPageIndex: React.Dispatch<React.SetStateAction<number>>;
  onExit: () => void;
}

const SWIPE_THRESHOLD = 50;

export default function ImageFullscreen({
  currentImage,
  jobName,
  pages,
  pageIndex,
  setPageIndex,
  onExit,
}: ImageFullscreenProps) {
  // 全屏图片触摸状态：竖向滑动翻页，同时拦截浏览器默认拖拽/平移
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);
  const suppressNextFullscreenClick = useRef(false);

  const isMultiPage = pages.length > 1;
  const currentPage = pages[pageIndex] || null;
  const imgSrc = apiClient.getImageUrl(
    currentPage?.image_url || currentPage?.image_path || currentImage
  );

  const consumeSuppressedFullscreenClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!suppressNextFullscreenClick.current) return false;
    suppressNextFullscreenClick.current = false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SOP 预览"
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        background: 'var(--axi-text, #000)', cursor: 'pointer', zIndex: 9999,
        userSelect: 'none',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'none',
      }}
      onClick={isMultiPage ? undefined : onExit}
      onTouchStart={(e) => {
        if (e.touches.length === 0) return;
        const touch = e.touches[0];
        touchStartPoint.current = { x: touch.clientX, y: touch.clientY };
        suppressNextFullscreenClick.current = false;
      }}
      onTouchMove={(e) => {
        if (!touchStartPoint.current) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchEnd={(e) => {
        if (!touchStartPoint.current) return;
        const { x, y } = touchStartPoint.current;
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - x;
        const deltaY = y - touch.clientY;
        touchStartPoint.current = null;
        const hasMoved = Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10;
        if (hasMoved) {
          suppressNextFullscreenClick.current = true;
          e.preventDefault();
          e.stopPropagation();
        }
        if (!isMultiPage || Math.abs(deltaY) <= SWIPE_THRESHOLD || Math.abs(deltaY) <= Math.abs(deltaX)) return;
        if (deltaY > 0) {
          // 向上滑 → 下一页
          setPageIndex(i => Math.min(pages.length - 1, i + 1));
        } else if (deltaY < -SWIPE_THRESHOLD) {
          // 向下滑 → 上一页
          setPageIndex(i => Math.max(0, i - 1));
        }
      }}
      onTouchCancel={() => {
        touchStartPoint.current = null;
        suppressNextFullscreenClick.current = false;
      }}
    >
      {/* 图片区域：点击边缘区域翻页 */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={(e) => {
          if (consumeSuppressedFullscreenClick(e)) return;
          if (!isMultiPage) {
            onExit();
          }
        }}
      >
        <img
          src={imgSrc}
          alt={jobName || 'SOP 预览'}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            if (consumeSuppressedFullscreenClick(e)) return;
            if (!isMultiPage) {
              onExit();
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            objectFit: 'fill',
            objectPosition: 'center',
            cursor: 'pointer',
            touchAction: 'none',
            userSelect: 'none',
          }}
        />
      </div>

      {/* 页码指示器 */}
      {isMultiPage && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)', color: 'white',
          padding: '6px 20px', borderRadius: 20,
          fontSize: 14, zIndex: 10001,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); setPageIndex(i => i - 1); }}
            disabled={pageIndex === 0}
            style={{
              background: 'rgba(255,255,255,0.15)', color: 'white',
              border: 'none', borderRadius: '50%', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: pageIndex === 0 ? 'default' : 'pointer', opacity: pageIndex === 0 ? 0.3 : 1,
            }}
          >
            <IconPrev />
          </button>
          <span style={{ minWidth: 80, textAlign: 'center' }}>
            {pageIndex + 1} / {pages.length}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setPageIndex(i => i + 1); }}
            disabled={pageIndex === pages.length - 1}
            style={{
              background: 'rgba(255,255,255,0.15)', color: 'white',
              border: 'none', borderRadius: '50%', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: pageIndex === pages.length - 1 ? 'default' : 'pointer', opacity: pageIndex === pages.length - 1 ? 0.3 : 1,
            }}
          >
            <IconNext />
          </button>
        </div>
      )}
    </div>
  );
}
