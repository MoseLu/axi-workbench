import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { iconPathMap } from '@/assets/icons';
import type { IconProps } from '@/assets/icons/types';

/**
 * Icon 组件 - SVG 图标包装器
 *
 * 渲染方式：fetch 远程 SVG → 内联 `dangerouslySetInnerHTML` 注入。
 *
 * 历史原因：原实现使用 `mask-image + backgroundColor`，但浏览器默认
 * `mask-mode: match-source`，SVG 作为 mask 时进入 luminance 模式，
 * SVG 内部 `currentColor` 不会继承父级 color（fallback 黑），
 * luminance mask 对全黑区域完全透明，导致暗色主题下图标不可见。
 *
 * 改为内联 SVG 后，`<path fill="currentColor">` 直接走父级 color，
 * 暗色主题 / 自定义 `color` 都能正确生效。
 *
 * 用法（向后兼容 239 个调用点）：
 *   <Icon name="legacy-edit" size={20} />
 *   <Icon name="status-success" color="var(--color-chart-2)" />
 */
type IconComponentProps = IconProps & {
  style?: CSSProperties;
  title?: string;
};

const Icon: React.FC<IconComponentProps> = ({
  name,
  size = 20,
  color = 'currentColor',
  className = '',
  center = false,
  onClick,
  style,
  title,
}) => {
  const path = iconPathMap[name];

  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    fetch(path)
      .then((res) => {
        if (!res.ok) return Promise.reject(new Error(`HTTP ${res.status}`));
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setSvgContent(text);
      })
      .catch(() => {
        // 静默失败：保留 null，由外层渲染占位方块，避免布局抖动。
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  // 把外部 SVG 内容清洗后注入：移除 XML prolog / DOCTYPE，
  // 并在 `<svg>` 上注入 `style="color:..."`，让内部
  // `fill="currentColor"` 引用父级 color；同时清掉 `<svg>` 上自带 fill。
  const cleanedSvg = svgContent
    ? svgContent
        .replace(/<\?xml[^>]*\?>/g, '')
        .replace(/<!DOCTYPE[^>]*>/g, '')
        .replace(/<svg([^>]*)>/, (_match, attrs) => {
          const newAttrs = attrs.replace(/\sfill="[^"]*"/g, '');
          return `<svg${newAttrs} style="color:${color};width:100%;height:100%">`;
        })
    : null;

  if (!path) {
    // 没有匹配图标：保持与旧实现一致的 console.warn 后返回 null
    // （不污染布局，调用方一般会自行兜底）。
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`Icon "${name}" not found`);
    }
    return null;
  }

  const outerStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    color,
    flexShrink: 0,
    ...(center ? { alignSelf: 'center' } : {}),
    ...style,
  };

  return (
    <span
      style={outerStyle}
      className={className}
      onClick={onClick}
      role="img"
      aria-label={title ?? name}
      title={title}
    >
      {cleanedSvg ? (
        <span
          aria-hidden="true"
          style={{ display: 'inline-flex', width: '100%', height: '100%' }}
          dangerouslySetInnerHTML={{ __html: cleanedSvg }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </span>
  );
};

export default Icon;
