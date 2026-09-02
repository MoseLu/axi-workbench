// 跨端共享类型占位（M14 骨架 + M21 navBadges 类型）。
// 真实实现：M15+ 把 web/mobile/desktop 共用的业务类型从这里 re-export。

export type Surface = 'web' | 'mobile' | 'desktop';

export type NavBadgeKind = 'none' | 'dot' | 'count';

export interface SharedNavBadge {
  kind: NavBadgeKind;
  value?: number;
}

/** 三端（web sidebar / mobile 底栏 / desktop Dock 标题）通用的未读徽章 DTO。 */
export type NavBadgeDto = {
  kind: NavBadgeKind | string;
  value?: number;
};

/** 归一化的徽章值 —— 跨端共享、可直接渲染。 */
export type NavBadge =
  | { kind: 'none' }
  | { kind: 'dot' }
  | { kind: 'count'; value: number };

/**
 * 把后端 DTO（容忍字符串脏数据、value 为负、为 NaN）归一化成 `NavBadge`。
 * 跨端通用 —— web 端在 navBadges.ts、mobile 端在 layout/MobileNav 用，
 * Desktop IPC payload type 也基于此转换。
 *
 * 规则：
 *   * `kind: 'dot'`         → { kind: 'dot' }
 *   * `kind: 'count'` + 正整数 → { kind: 'count', value }
 *   * `kind: 'count'` + 0 / 负 / NaN → { kind: 'none' }（不显示）
 *   * 其它 / undefined       → { kind: 'none' }
 */
export function toNavBadge(dto?: NavBadgeDto): NavBadge {
  if (!dto) return { kind: 'none' };
  const kind = String(dto.kind || 'none').toLowerCase();
  if (kind === 'dot') return { kind: 'dot' };
  if (kind === 'count') {
    const value = Number(dto.value) || 0;
    return value > 0 ? { kind: 'count', value } : { kind: 'none' };
  }
  return { kind: 'none' };
}