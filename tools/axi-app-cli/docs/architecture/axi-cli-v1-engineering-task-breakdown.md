# Axi CLI v1 Engineering Task Breakdown

## 1. 说明

本文档将 [F:\enterprise-workspace\projects\axi-app-cli\docs\architecture\axi-cli-v1-implementation-plan.md](F:\enterprise-workspace\projects\axi-app-cli\docs\architecture\axi-cli-v1-implementation-plan.md) 继续拆成工程任务。

任务拆分原则：

- 优先围绕 runtime contract，而不是围绕某个示例模块
- 优先清理核心特殊逻辑，而不是继续加新能力
- 优先锁定 inspection / mutation / repair 的边界
- 每个任务尽量有明确完成标准

## 2. Epic A：Runtime Core

### AXI-101 定义 runtime command class

目标：

- 在类型和执行层中正式区分 `inspection / mutation / repair`

完成标准：

- 命令分类不再只是文档概念
- `list`、`doctor`、`doctor --fix`、`sync` 的行为边界可通过类型和测试验证

### AXI-102 定义 runtime phase 枚举与执行骨架

目标：

- 将 bootstrap、policy load、snapshot load、assembly、execution、persist 等 phase 代码化

完成标准：

- 执行主路径中可见 phase
- 后续 warmup / profiler / progress output 可以绑定 phase

### AXI-103 抽离统一 command dispatcher

目标：

- 将命令分发从当前 `runCli` 内联逻辑收紧成清晰 dispatch

完成标准：

- scaffold 命令和 ops 命令进入不同执行通道
- 主入口只负责快路径判断和 dispatch

### AXI-104 明确 policy / snapshot / applied state contract

目标：

- 固化三层状态的职责边界

完成标准：

- `.axi/modules.json` 只表达 desired state
- `.axi/scaffold.manifest.json` 只表达 applied state
- 运行时装配态不回写混杂字段

## 3. Epic B：Contribution Runtime

### AXI-201 建立 typed contribution family

目标：

- 将 contribution 从字符串类型升级成受约束的 family

建议 family：

- `template`
- `doc-fragment`
- `command`
- `doctor-check`
- `sync-transform`
- `warmup`
- `policy`
- `preset`

完成标准：

- 新 contribution 不依赖裸字符串扩展

### AXI-202 清理模块专用 helper

目标：

- 把主题等特化 helper 尽可能改为 contribution resolver

完成标准：

- 核心 runtime 不再直接理解特定模块业务语义

### AXI-203 增加 contribution assembly order

目标：

- 明确不同 contribution 的装配顺序与冲突策略

完成标准：

- 同类 contribution 的优先级、合并规则有定义

### AXI-204 补模块冲突与条件机制

目标：

- 除依赖之外，引入 `conflicts` 与 `conditions`

完成标准：

- 不合法模块组合在 assembly/preflight 时可诊断

### AXI-205 准备模块 manifest 外提方案

目标：

- 为未来 `module.manifest.ts` 或外部模块包留接口

完成标准：

- manifest 与 apply 的分离方案被代码与文档确认

## 4. Epic C：CLI Product Surface

### AXI-301 改造 thin bootstrap

目标：

- 让 [F:\enterprise-workspace\projects\axi-app-cli\src\cli.ts](F:\enterprise-workspace\projects\axi-app-cli\src\cli.ts) 只负责超轻入口

完成标准：

- `--help`、`--version` 可直接返回
- 其他路径走动态装配

### AXI-302 按命令动态加载运行模块

目标：

- 避免 inspection 路径无意义加载 scaffold 全量依赖

完成标准：

- `list` / `doctor` 和 `init/create/add/sync` 走不同加载分支

### AXI-303 统一输出 contract

目标：

- 人类输出和 JSON 输出都走统一数据模型

完成标准：

- inspection 输出字段稳定
- mutation 输出具备阶段摘要

### AXI-304 统一错误与退出码策略

目标：

- 明确哪些错误应该返回非 0
- 明确 drift、fix failure、config error 的退出语义

完成标准：

- 测试锁住退出码和错误文本形态

### AXI-305 设计 startup profiler 和 warmup 接口

目标：

- 先把体验增强能力定义成 foundation capability，不急着全量启用

完成标准：

- profiler/warmup 可以挂接到 phase
- 仍保持默认实现克制

## 5. Epic D：Scaffold Output

### AXI-401 收紧 token domain 目录粒度

目标：

- 让 foundation token 继续按领域解耦

建议至少覆盖：

- `space`
- `radius`
- `shadow`
- `border`
- `background`
- `layout`
- `motion`
- `interaction`
- `typography`

完成标准：

- token source 粒度与 SCSS 输出树对齐

### AXI-402 锁定 JSON source + SCSS output 模型

目标：

- 确保生成项目直接消费 SCSS，同时保留 JSON 作为源定义

完成标准：

- 文档、构建和示例统一使用该模型

### AXI-403 收紧 theme mode / preset 正交模型

目标：

- 保证 `mode × preset` 是正交组合，而不是互相覆盖

完成标准：

- 新增风格不需要碰核心模式算法

### AXI-404 继续强化 Feature-Based 目录规则

目标：

- 确保生成项目的 web/api 结构保持领域导向

完成标准：

- hooks/shared/app/features 的归属规则清晰
- 后端装配层与 feature 层职责清晰

### AXI-405 文档模板对齐新运行时

目标：

- 让生成项目内的 README/AGENTS/MODULES 等文件与新的 runtime 模型保持一致

完成标准：

- 生成项目文档能解释 policy/snapshot/sync/doctor 心智

## 6. Epic E：Verification And Repair

### AXI-501 增加 runtime contract 测试

目标：

- 给 command class、phase、policy/snapshot 行为补测试

完成标准：

- 核心运行时的行为变化会触发测试

### AXI-502 增加 contribution assembly 测试

目标：

- 锁住依赖、冲突、条件、优先级

完成标准：

- 新模块接入时能快速识别装配破坏

### AXI-503 增加 JSON output contract 测试

目标：

- 锁住 `list --json` 和 `doctor --json` 输出结构

完成标准：

- 自动化依赖字段不会被无意破坏

### AXI-504 增加 repair 边界测试

目标：

- 确保 `doctor --fix` 不越界处理非受管内容

完成标准：

- stale cleanup、policy normalization、sync repair 都有边界用例

### AXI-505 增加生成链路 smoke matrix

目标：

- 验证默认 scaffold、增量 add、sync replay 的主路径

完成标准：

- 可覆盖至少：
  - create
  - add
  - sync
  - doctor --fix

## 7. Epic F：Docs And Governance

### AXI-601 增加版本发布检查单

目标：

- 将 v1 发布门槛文档化

完成标准：

- 有明确 release checklist

### AXI-602 同步 MILESTONE / TODO / README

目标：

- 避免根级文档与 PRD/Implementation Plan 脱节

完成标准：

- 根级文档可作为外层索引阅读

### AXI-603 为模块作者准备作者指南

目标：

- 降低未来增加模块时的心智负担

完成标准：

- 至少说明 manifest、dependencies、contributions、managed files 规则

## 8. 推荐执行顺序

推荐顺序如下：

1. `AXI-101` 到 `AXI-104`
2. `AXI-201` 到 `AXI-204`
3. `AXI-301` 到 `AXI-304`
4. `AXI-501` 到 `AXI-504`
5. `AXI-401` 到 `AXI-405`
6. `AXI-205`
7. `AXI-305`
8. `AXI-505`
9. `AXI-601` 到 `AXI-603`

## 9. 建议的 v1.0 关闭条件

以下任务完成后，可以认为 Axi 进入更稳的 v1.0 状态：

- Runtime Core 任务全部完成
- Contribution Runtime 主要任务完成
- CLI Product Surface 的 bootstrap / dispatch / output / exit 语义完成
- Repair 与 JSON contract 测试完成
- Scaffold output 文档与生成链路通过 smoke 验证

## 10. 后续可追加但不阻塞 v1.0 的项目

- early input buffering
- startup profiler 默认启用
- 远程模块 catalog
- 外部模块包加载
- 更复杂的 experimental capability packs
