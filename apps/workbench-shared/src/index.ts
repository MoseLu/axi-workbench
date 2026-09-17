/**
 * @axi/workbench-shared —— 跨端共享纯函数 / 工具 / 类型。
 *
 * 设计原则：
 * 1. **纯函数优先**：hooks 仅依赖 react + 共享 contracts，不调用任何平台 API
 *    （无 fetch、无 Tauri IPC、无 React Router）。三端各自的封装层（web/mobile/desktop）
 *    在上层包做。
 * 2. **零 UI**：不导出组件、不依赖 @axi/shell/@axi/widgets 等 UI 库。
 * 3. **类型公开**：所有函数都有完整的 TS 类型签名，便于端到端推导。
 *
 * 当前模块（M14 骨架）：
 * - `./format`   —— 跨端一致的日期、数字、状态文本格式化
 * - `./hooks`    —— 通用 hooks（useDebouncedValue 等）
 * - `./types`    —— 共享类型导出
 *
 * 不归这里：
 * - 任何带 fetch 的 API 客户端（请用 @epap/api-client）
 * - 任何带路由的页面级工具（各端自管理）
 * - 任何 i18n / locale（请用 @axi/workbench-foundation）
 */

// M14 占位 —— 待 M15+ 实际搬代码
export const SHARED_PACKAGE_NAME = '@axi/workbench-shared';
export const SHARED_PACKAGE_VERSION = '0.1.0';