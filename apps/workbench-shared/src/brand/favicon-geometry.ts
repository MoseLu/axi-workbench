/**
 * Dango family favicon contract shared by Web, Mobile, and Desktop.
 *
 * 这是 favicon 视觉契约的 **单源**：
 *   - apps/workbench/public/favicon.svg          (brand image wrapper)
 *   - apps/workbench-desktop/src-tauri/icons/icon.svg (desktop image master)
 *   - apps/workbench-mobile/public/favicon.svg   (mobile, byte-identical to web)
 *
 * 数据载体是 `favicon-geometry.json`(纯数据,可被 .mjs 脚本运行时读取)；
 * 本文件仅 re-export 类型与常量,保持 TS 项目中的类型推断能力。
 *
 * The fixed seven-member family order is intentionally kept in this data
 * contract so a future logo edit cannot silently reorder the family.
 */

import data from './favicon-geometry.json' with { type: 'json' };

export const FAVICON_GEOMETRY = data;

export type FaviconGeometry = typeof data;

export const FAVICON_INVARIANTS = data.invariants;
export type FaviconInvariants = typeof data.invariants;
