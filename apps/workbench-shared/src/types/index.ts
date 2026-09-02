// 跨端共享类型占位（M14 骨架）。
// 真实实现：M15+ 把 web/mobile/desktop 共用的业务类型从这里 re-export。

export type Surface = 'web' | 'mobile' | 'desktop';

export type NavBadgeKind = 'none' | 'dot' | 'count';

export interface SharedNavBadge {
  kind: NavBadgeKind;
  value?: number;
}