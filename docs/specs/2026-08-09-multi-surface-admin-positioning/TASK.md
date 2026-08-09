# 多端后台产品架构定位 — 任务

## 范围

以产品定位为约束的实现批次：覆盖 Web、Mobile、Gateway、Control Plane、共享 schemas、Host 受控入口及对应验证。保留既有未提交的登录、邮箱与服务端改动，不将其纳入本批次。

## 已完成：定位与设计依据

- [x] 以官方公开页面调研千牛、美团商家版、携程 eBooking、飞猪商家中心，记录可迁移的多端角色/任务模式与明确的非推导边界。
- [x] 将项目级 PRD 从“主端/辅助端”的静态分工升级为“Web 控制中心 / Mobile 角色执行端 / 专业工具 + 共享底座”架构。
- [x] 定义 A/B/C/D 动作等级和每项能力的动作政策要求，避免以屏幕尺寸或操作重要性单因素分端。
- [x] 复核桌面工作台公开产品形态，纠正将浏览器能力误置为 Web“通用识别”的设计：Web 保留跨项目运行状态和工作项，Mobile 保持“4 个常驻导航 + 顶部 Scan 动作”。
- [x] 将架构需求加入 TDD、TODO、Milestone、manifest、Handoff 和 Changelog 的追溯链。

## 后续实施顺序

- [x] P0 / REQ-ARCH-001 / REQ-ACTION-001：盘点现有用户能力，逐项补齐表面、角色、动作等级与动作政策。
- [x] P1 / REQ-WEB-001：按控制对象收敛 Web 主导航和桌面管理页面优先级。
- [x] P2 / REQ-MOBILE-001：按值班/现场角色梳理 Mobile 的 A/B 级任务闭环、状态重验与 Web 交接。
- [x] P3 / REQ-CROSS-001：落实共享对象标识、动作政策接口、审计与 `handoff correlation id`。
- [x] P4 / REQ-SURFACE-001：治理专业工具入口、授权与审计，避免 D 级操作进入通用后台。
- [x] P5 / REQ-DELIVERY-001：将能力台账和动作政策评审设为所有用户能力开发的准入条件。
- [x] P1 修正：从 Web 导航、搜索和实现中移除通用摄像头扫码；新增由真实 Control Plane 快照驱动的“运行状态”，将“工作区”收敛为可检索、可筛选的“工作项”队列。

## 验收边界

- 公开案例研究只支撑产品架构定位，不能证明 Workbench 已具备相应功能。
- 新增用户能力必须更新 `CAPABILITY-INVENTORY.json`，通过 `pnpm check:capabilities` 和 `pnpm check:boundaries`，并按 TDD 选择最小验证集。
