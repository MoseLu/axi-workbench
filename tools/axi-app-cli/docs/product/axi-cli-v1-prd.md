# Axi CLI v1 PRD

## 1. 文档目标

本文档定义 `Axi CLI v1` 的产品目标、用户问题、核心能力、范围边界与验收标准。

这份 PRD 的目标不是描述某个单点命令，而是将 Axi 定义为一个：

- 面向长期演进的脚手架产品
- 以模块装配为核心的能力平台
- 同时服务人类用户与自动化系统的 CLI 产品

## 2. 背景

现有大多数脚手架工具擅长“创建项目”，但不擅长“持续演进项目”。

常见问题包括：

- 初始化之后，后续增量加能力只能手工改仓库
- 可选模块越来越多后，命令面和配置面开始混乱
- 交互式模式和自动模式行为不一致
- `list`、`doctor`、`sync`、`repair` 没有统一的心智模型
- 模块系统只会“生成文件”，不会“贡献能力”
- 随着功能增多，CLI 从产品退化成脚本集合

对 Axi 来说，脚手架不是一次性模板生成器，而是一个长期维护项目结构、策略和能力组合的产品表面。

## 3. 机会判断

参考 Claude Code 一类成熟终端产品的分析，可以抽象出几条对 Axi 有直接价值的规律：

- 核心循环必须小，复杂能力通过外围模块接入
- 分层要按职责和运行温度，而不是按源码目录名
- 默认策略要保守，失败时优先收缩权限和写入范围
- 读路径、写路径、修复路径必须明确分离
- 静态定义、动态状态、已应用快照必须解耦
- 体验不是后置润色，而是架构设计的一部分

因此，Axi v1 的产品方向应当是：

- 用一个稳定的核心模型管理脚手架生命周期
- 用三层模块系统承载渐进式演进
- 用统一命令面和状态模型承载复杂度增长

## 4. 产品定义

`Axi CLI v1` 是一个模块化全栈脚手架平台，负责：

- 初始化新项目或当前空目录
- 以策略驱动方式启用、追加、关闭和同步模块
- 输出可直接使用的工程骨架、文档、设计 token 与质量门禁
- 提供 inspection、repair、sync、automation 友好的 CLI 体验

它不是：

- 单次生成后即失效的一次性模板
- 只负责写文件、不负责状态管理的代码生成器
- 只给人用、不考虑 CI/脚本系统的交互壳

## 5. 产品目标

### 5.1 核心目标

1. 建立稳定心智模型  
   用户始终围绕“期望状态、已应用状态、同步与诊断”来理解系统。

2. 建立 Lego 式模块架构  
   模块可以替换、追加、停用和演进，三层架构固定，模块内容不固定。

3. 保证 CLI 作为产品可持续扩展  
   命令越来越多后，体验和语义仍然保持统一，不退化成命令拼盘。

4. 保证人类模式与自动化模式同构  
   交互式、`--yes`、`--json`、CI 使用的结果模型保持一致。

5. 为后续主题系统、样式系统、组件包、实验模块留足扩展位  
   v1 先打底座，不把未来能力硬编码进核心。

### 5.2 业务目标

- 让一个空目录可以快速进入“可持续迭代”的工程状态
- 让后续的模块追加、关闭和修复可预测
- 降低脚手架自身演进对已有项目的破坏性

## 6. 非目标

以下内容不属于 v1 的直接目标：

- 完整业务功能实现
- 所有可想象模块的一次性内置
- 远程模板市场或模块市场
- 可视化 GUI 管理台
- 深度云端服务集成
- 一次性解决所有启动性能优化

## 7. 目标用户

### 7.1 项目创建者

需要从零启动项目，希望快速得到：

- 推荐结构
- 关键文档
- 测试约束
- 可后续演进的模块化底座

### 7.2 项目维护者

已经有 Axi 项目，希望：

- 查看当前模块状态
- 诊断配置与实际输出是否漂移
- 追加或关闭模块
- 执行受控修复

### 7.3 平台作者 / 模块作者

希望围绕统一协议为 Axi 增加：

- 新模块
- 新预设
- 新文档片段
- 新检查项
- 新同步逻辑

### 7.4 自动化系统 / CI

希望通过稳定输出完成：

- 状态检测
- 健康校验
- 同步执行
- 失败判断

## 8. 核心产品原则

### 8.1 小核心，大外围

核心运行时只负责：

- 加载策略
- 加载快照
- 装配模块图
- 执行对应 phase
- 写回快照

主题、样式、组件、实验能力都不应侵入核心调度器。

### 8.2 默认保守

所有高风险行为默认收缩：

- 未声明安全写入边界的模块，不允许随意覆盖文件
- inspection 命令默认只读
- repair 默认只修受管内容
- 未满足依赖的模块不得静默启用

### 8.3 命令同构

交互式与自动模式只改变“确认方式”，不改变“结果语义”。

### 8.4 状态分层

必须明确区分：

- 期望状态：`.axi/modules.json`
- 已应用快照：`.axi/scaffold.manifest.json`
- 运行装配态：当前内存中的模块图和贡献图

### 8.5 模块可见

模块不是内部实现细节，用户必须能知道：

- 它属于哪一层
- 是否默认启用
- 是否当前启用
- 依赖谁
- 贡献了什么

## 9. 核心心智模型

用户操作 Axi 时，应始终面对同一模型：

1. `policy` 决定“应该启用什么”
2. `snapshot` 记录“当前已经应用了什么”
3. `sync` 负责把两者对齐
4. `doctor` 负责解释漂移、缺失和异常
5. `list` 负责展示当前模块形态

这是 Axi v1 最重要的产品心智，不允许后续功能破坏这一点。

## 10. 范围定义

### 10.1 v1 必须具备的命令能力

- `axi init`
- `axi create <name>`
- `create-axi-app <name>`
- `axi add <module-id...>`
- `axi sync`
- `axi list`
- `axi doctor`

### 10.2 v1 必须具备的状态能力

- 生成并维护 `.axi/modules.json`
- 生成并维护 `.axi/scaffold.manifest.json`
- 记录模块的 `id / layer / enabled / version / dependencies / configKey`
- 支持从期望状态回放同步

### 10.3 v1 必须具备的模块能力

模块至少支持三层：

- `foundation`
- `extension`
- `experimental`

每个模块至少具备以下基础属性：

- `id`
- `layer`
- `version`
- `enabledByDefault`
- `configKey`
- `dependencies`

### 10.4 v1 必须具备的工程输出能力

生成项目需要至少包含：

- 前端 `Vite + React + TypeScript + Zod`
- 后端 `Flask + pytest`
- `Style Dictionary + SCSS`
- Feature-Based 目录结构
- PRD / TDD / README / AGENTS / TODO / MILESTONE / CHANGELOG
- 测试覆盖门禁
- Git hooks 基线

### 10.5 v1 必须具备的运维能力

- `list --json`
- `doctor --json`
- `doctor --fix`
- 清理停用模块遗留的受管文件
- 以明确退出码表达成功、失败、漂移

## 11. 模块架构要求

### 11.1 三层架构

#### Foundation

基础能力层，提供最小必需底座。

特征：

- 项目通常不可或缺
- 关闭成本高
- 对其他模块形成依赖基础

#### Extension

扩展能力层，提供可选增强。

特征：

- 可以单独安装或禁用
- 通过依赖和贡献协议与基础层连接
- 不应破坏核心心智模型

#### Experimental

实验能力层，承载待验证功能。

特征：

- 默认不影响主路径
- 隔离配置
- 可启用、可观察、可关闭

### 11.2 模块解耦要求

模块必须像积木一样可组合，而不是写死在调度器里。

要求：

- 模块内容可以任意替换
- 模块名不构成架构的一部分
- 默认模块组合应由 preset/policy 决定，而不是 registry 写死
- 实现与清单应逐步分离

## 12. Contribution 能力要求

v1 允许模块不只贡献文件，还应为后续升级预留能力入口。

至少需要支持向统一运行时贡献：

- 模板片段
- 文档片段
- 检查项
- 同步转换
- 预热任务
- 命令扩展位
- 预设策略

即使 v1 不是每一类都 fully powered，也必须在架构层面预留 typed contributions 的设计空间。

## 13. 关键用户流程

### 13.1 首次创建

用户在空目录或新目录中运行创建命令。

期望体验：

- 明确告诉用户会生成什么
- 支持交互式逐步确认
- 支持 `--yes` 全自动推荐路径
- 生成后可以直接启动、测试和继续追加模块

### 13.2 追加模块

用户希望在已有项目中增加新能力。

期望体验：

- 能看懂目标模块依赖什么
- 追加后 policy 和 snapshot 同步更新
- 仅在受管边界内写入新增内容

### 13.3 查看状态

用户希望知道项目当前处于什么形态。

期望体验：

- `list` 能清楚展示模块按层分布
- `doctor` 能清楚解释 drift、缺失和建议修复
- `--json` 可供自动化直接消费

### 13.4 修改策略后回放

用户手工编辑 `.axi/modules.json` 后，希望项目重新与策略对齐。

期望体验：

- `sync` 负责回放和对齐
- 能补齐新增模块
- 能清理停用模块受管产物
- 对无法安全处理的内容明确告警

### 13.5 受控修复

用户面对漂移、遗留文件、配置不一致时，需要快速修正。

期望体验：

- `doctor --fix` 先说明修复边界
- 默认只修复受管内容
- 产出明确的修复摘要

## 14. CLI 体验要求

### 14.1 人类体验

- 输出必须有阶段感
- 长流程必须说明当前 phase
- 错误必须说明失败点和下一步
- 交互模式必须尽量减少认知跳转

### 14.2 机器体验

- inspection 命令支持结构化输出
- 输出字段稳定
- 退出码可脚本依赖
- stdout/stderr 职责清楚

### 14.3 性能体验

v1 不以极限启动优化为主目标，但必须建立正确方向：

- 快路径优先
- inspection 命令尽量轻量
- 后续支持按命令动态装配能力
- 后续支持预热、early input、profile 等体验增强能力

## 15. 设计 Token 与样式系统要求

生成项目的设计系统需要支持：

- `light` / `dark` 两种模式
- 多种风格预设并与模式正交组合
- foundation token 与 theme preset 解耦
- JSON 作为源定义
- SCSS 文件树作为直接消费层

Token 组织要求：

- 各领域独立拆分
- 如 `space`、`radius`、`shadow`、`background`、`border`、`motion`、`typography` 各自独立
- 风格预设与模式预设互不耦合

## 16. 文档与治理要求

每个生成项目至少提供：

- `README.md`
- `AGENTS.md`
- `TODO.md`
- `MILESTONE.md`
- `CHANGELOG.md`
- PRD/TDD 模板或入口文档
- 模块说明文档

规则要求：

- PRD 驱动
- TDD 驱动
- 覆盖率门禁
- Feature-Based 组织优先
- hooks 与模块归属清晰

## 17. 非功能要求

### 17.1 可演进性

- 新模块加入不应要求改写核心运行时
- 默认组合变化不应要求改写 registry 核心

### 17.2 可诊断性

- 漂移必须可见
- 模块状态必须可见
- 修复边界必须可见

### 17.3 可恢复性

- 失败后应保留足够状态供用户继续
- 不应将项目带入不可理解的半完成态

### 17.4 安全性

- 默认不覆盖非受管文件
- 默认不假设模块写入可并发
- 默认不自动绕过依赖约束

## 18. 成功指标

v1 关注的是产品底座质量，而非单一流量指标。

核心成功信号：

- 用户可以只通过 `policy / snapshot / sync / doctor / list` 理解系统
- 新模块可以在不破坏主路径的情况下接入
- 交互式与 `--yes` 路径结果一致
- inspection / repair / mutation 三类命令边界清晰
- 生成项目能开箱即用并支持后续渐进迭代

## 19. 验收标准

### 19.1 产品验收

- CLI 对外语义清晰，命令边界明确
- 三层模块系统已落地，不依赖示例模块名
- 状态文件与同步心智稳定
- README 和文档能解释这套模型

### 19.2 技术验收

- 可创建新项目
- 可对已有项目追加模块
- 可通过编辑 `.axi/modules.json` 后执行 `sync`
- 可通过 `list` 与 `doctor` 查看状态
- 可通过 `doctor --fix` 做受控修复
- 可输出 JSON 结果供脚本消费

### 19.3 体验验收

- 命令输出可读
- 失败提示有下一步建议
- 自动模式可直接跑通推荐路径
- inspection 命令足够轻量，适合重复运行

## 20. 里程碑建议

### M1：底座稳定

- 完成三层模块系统
- 完成 policy / snapshot / sync / doctor / list 闭环
- 完成文档主线

### M2：能力贡献化

- 模块从“生成文件”升级为“贡献能力”
- 引入 typed contributions
- 引入 phase-aware runtime

### M3：CLI 产品化增强

- 快路径和重路径分离
- 启动预热与 profiling
- 更强的交互与 JSON UX

### M4：生态开放

- 外部模块清单
- 预设策略包
- 实验层能力扩展

## 21. 依赖文档

- [F:\enterprise-workspace\projects\axi-app-cli\docs\research\claude-code-sourcemap-analysis.md](F:\enterprise-workspace\projects\axi-app-cli\docs\research\claude-code-sourcemap-analysis.md)
- [F:\enterprise-workspace\projects\axi-app-cli\docs\product\cli-product-principles.md](F:\enterprise-workspace\projects\axi-app-cli\docs\product\cli-product-principles.md)
- [F:\enterprise-workspace\projects\axi-app-cli\docs\product\command-ux-specification.md](F:\enterprise-workspace\projects\axi-app-cli\docs\product\command-ux-specification.md)
- [F:\enterprise-workspace\projects\axi-app-cli\docs\architecture\module-contribution-schema.md](F:\enterprise-workspace\projects\axi-app-cli\docs\architecture\module-contribution-schema.md)
- [F:\enterprise-workspace\projects\axi-app-cli\docs\architecture\runtime-lifecycle-specification.md](F:\enterprise-workspace\projects\axi-app-cli\docs\architecture\runtime-lifecycle-specification.md)
- 参考文章：[面试官皱眉：“没用过 Claude Code 也敢来？” 我不屑：“但我能写一个！”，他愣了：等等我记一下…](https://mp.weixin.qq.com/s/ldp-p2-dMJifjsd_dmmqQg)
