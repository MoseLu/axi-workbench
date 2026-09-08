/**
 * Favicon 几何契约 —— 跨 web、mobile、desktop 三端共享的 12 瓣花心 favicon 形状 / 颜色 / 路径常量。
 *
 * 这是 favicon 视觉契约的 **单源**：
 *   - apps/workbench/public/favicon.svg          (品牌图本体,设计调整时才动)
 *   - apps/workbench-desktop/src-tauri/icons/icon.svg (桌面图标母版)
 *   - apps/workbench-mobile/public/favicon.svg   (mobile,必须与 web byte-identical)
 *
 * 数据载体是 `favicon-geometry.json`(纯数据,可被 .mjs 脚本运行时读取)；
 * 本文件仅 re-export 类型与常量,保持 TS 项目中的类型推断能力。
 *
 * 任何对 favicon 几何 / 颜色顺序的改动,都必须先改 `.svg` 设计,再同步本常量,
 * 然后 desktop + mobile 双端校验脚本自动跟随。
 */

import data from './favicon-geometry.json' with { type: 'json' };

export const FAVICON_GEOMETRY = data;

export type FaviconGeometry = typeof data;

export const FAVICON_INVARIANTS = data.invariants;
export type FaviconInvariants = typeof data.invariants;