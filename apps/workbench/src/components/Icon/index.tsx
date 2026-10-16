import React, { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { iconSvgMap } from '@/assets/icons';
import type { IconProps } from '@/assets/icons/types';

/**
 * Icon 组件 - SVG 图标包装器
 *
 * 渲染方式：构建期 `import.meta.glob` + `?raw` 把所有 SVG 文本内联到 bundle，
 * 把所有 SVG 文本内联到 bundle，运行时通过 `dangerouslySetInnerHTML` 注入。
 * 注入前用 DOMParser 做 XSS 清洗（白名单标签 + 去除 on* / javascript:）。
 *
 * 历史原因：原实现使用 `mask-image + backgroundColor`，但浏览器默认
 * `mask-mode: match-source`，SVG 作为 mask 时进入 luminance 模式，
 * SVG 内部 `currentColor` 不会继承父级 color（fallback 黑），
 * luminance mask 对全黑区域完全透明，导致暗色主题下图标不可见。
 *
 * 改为内联 SVG 后，`<path fill="currentColor">` / `<path stroke="currentColor">`
 * 通过清洗阶段注入的 `style="color:..."` 引用父级 color，
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

// 白名单 SVG 标签。任何不在白名单内的元素会被整枝剪掉（不只清属性）。
// 注意排除 `<image>` / `<foreignObject>` / `<script>` / `<use href="javascript:...">`
// 等已知 XSS 向量：它们或允许执行脚本（script / foreignObject），或允许
// `href="javascript:..."`（image / use），均不在白名单内。
const ALLOWED_TAGS = new Set([
  'svg',
  'g',
  'defs',
  'style',
  'title',
  'desc',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'use',
  'symbol',
  'marker',
  'mask',
  'clippath',
  'pattern',
  'lineargradient',
  'radialgradient',
  'stop',
]);

/**
 * 对原始 SVG 文本做 XSS 清洗：DOMParser 解析 → 递归 white-list 标签 →
 * 清除 `on*` 事件属性 / `javascript:` 协议 → 在 `<svg>` 根注入 color/尺寸
 * style，让内部 `currentColor` 引用父级 color。
 *
 * SSR fallback：服务端渲染时（无 `window` / `DOMParser`）原样返回。
 * Vite SPA 模式下运行时为 browser 环境，正常清洗。
 */
function sanitizeSvg(raw: string, color: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return raw;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return raw;

  // 清洗 `<svg>` 根自身：移除 fill/stroke 让 currentColor 生效，
  // 然后注入 color 让内部 currentColor 引用父级 color。
  // 保留 width/height 由外层 span 控制，避免被图标内的 width/height 干扰。
  const rootAttrs = [...svg.attributes];
  for (const attr of rootAttrs) {
    const name = attr.name.toLowerCase();
    if (name === 'onload' || name.startsWith('on')) {
      svg.removeAttribute(attr.name);
      continue;
    }
    if (attr.value.trim().toLowerCase().startsWith('javascript:')) {
      svg.removeAttribute(attr.name);
      continue;
    }
    // 把图标自身声明的 fill / stroke / style 替换为受控值，避免图标里
    // 写死的颜色覆盖父级 color。
    if (name === 'fill' || name === 'stroke' || name === 'style') {
      svg.removeAttribute(attr.name);
    }
  }
  svg.setAttribute(
    'style',
    `color:${color};width:100%;height:100%;fill:currentColor;stroke:currentColor`,
  );

  // 递归清洗子树
  const walk = (el: Element): void => {
    const children = [...el.children];
    for (const child of children) {
      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        child.remove();
        continue;
      }
      // 逐个属性检查：on* 事件 / javascript: 协议
      const attrs = [...child.attributes];
      for (const attr of attrs) {
        const aName = attr.name.toLowerCase();
        if (aName.startsWith('on')) {
          child.removeAttribute(attr.name);
          continue;
        }
        const v = attr.value.trim().toLowerCase();
        if (v.startsWith('javascript:') || v.startsWith('data:text/html')) {
          child.removeAttribute(attr.name);
          continue;
        }
        // 显式清掉图标自带 fill / style，避免图标颜色压过 currentColor。
        // 注意：保留 stroke-width / stroke-linecap 等结构属性。
        if (
          aName === 'fill' ||
          aName === 'style' ||
          aName === 'class'
        ) {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };
  walk(svg);

  return svg.outerHTML;
}

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
  const rawSvg = iconSvgMap[name];

  // 同步清洗缓存：name / color 变化时重算。
  // 这样避免了之前 fetch + useState 的异步延迟，也消除了 `dist/` 缺失文件
  // 导致的 404 静默失败（构建期 SVG 已 inline 进 bundle）。
  const cleanedSvg = useMemo(() => {
    if (!rawSvg) return null;
    return sanitizeSvg(rawSvg, color);
  }, [rawSvg, color]);

  if (!rawSvg) {
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