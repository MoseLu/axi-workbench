/**
 * M53：跨端 DOM meta 标签 hooks（title / favicon / meta tags）。
 *
 * 设计原则：副作用只在客户端运行（typeof document 检查）；
 * component unmount 时自动恢复原值。
 */

/**
 * 同步 document.title —— 三端通用：详情页 / 加载态 / 错误页。
 * component unmount 时自动恢复原 title（默认行为）。
 */
export function useDocumentTitle(title: string, options: { restoreOnUnmount?: boolean } = {}): void {
  const { restoreOnUnmount = true } = options;
  useEffect(() => {
    const previous = typeof document !== 'undefined' ? document.title : '';
    if (typeof document !== 'undefined') document.title = title;
    return () => {
      if (restoreOnUnmount && typeof document !== 'undefined') {
        document.title = previous;
      }
    };
  }, [title, restoreOnUnmount]);
}

/**
 * 同步 favicon —— 跨端通用：通知红点 / 多主题切换。
 * 用 link[rel=icon] 的 href 属性。
 */
export function useFavicon(href: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let link = document.querySelector<HTMLLinkElement>('link[rel*="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    const previousHref = link.getAttribute('href');
    link.setAttribute('href', href);
    return () => {
      if (link && previousHref !== null) link.setAttribute('href', previousHref);
    };
  }, [href]);
}

/**
 * 同步 meta 标签 —— 跨端通用：description / theme-color / og:tags。
 * 自动创建（如不存在）或更新（如存在）。
 */
export function useMeta(name: string, content: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
    }
    const previous = meta.getAttribute('content');
    meta.setAttribute('content', content);
    return () => {
      if (meta && previous !== null) meta.setAttribute('content', previous);
    };
  }, [name, content]);
}

// Re-export for convenience from one entry point
import { useEffect } from 'react';