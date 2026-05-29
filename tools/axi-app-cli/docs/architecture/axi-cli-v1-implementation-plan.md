# Axi CLI v1 Implementation Plan

## 1. 目标

本文档将 [F:\enterprise-workspace\projects\axi-app-cli\docs\product\axi-cli-v1-prd.md](F:\enterprise-workspace\projects\axi-app-cli\docs\product\axi-cli-v1-prd.md) 转换为可执行的实现路径。

目标不是重新定义需求，而是回答三个问题：

- 当前仓库已经具备了什么
- 距离 v1 还有哪些关键缺口
- 应该按什么顺序落地，才能让风险最低、体验最稳

## 2. 当前基线

从当前仓库结构看，Axi 已经具备 v1 的重要底座：

- 命令面已存在：`init / create / add / sync / list / doctor`
- 三层模块已存在：`foundation / extension / experimental`
- 期望状态与快照文件已存在：
  - `.axi/modules.json`
  - `.axi/scaffold.manifest.json`
- 模块 registry 已存在
- 默认 preset 已存在
- 生成器已按 web/api/tokens/docs/scripts 拆分
- 运维命令已具备 `--json` 与 `--fix` 基础能力

可以直接从代码中看到这些基线入口：

- [F:\enterprise-workspace\projects\axi-app-cli\src\cli.ts](F:\enterprise-workspace\projects\axi-app-cli\src\cli.ts)
- [F:\enterprise-workspace\projects\axi-app-cli\src\core\scaffold.ts](F:\enterprise-workspace\projects\axi-app-cli\src\core\scaffold.ts)
- [F:\enterprise-workspace\projects\axi-app-cli\src\core\ops.ts](F:\enterprise-workspace\projects\axi-app-cli\src\core\ops.ts)
- [F:\enterprise-workspace\projects\axi-app-cli\src\types.ts](F:\enterprise-workspace\projects\axi-app-cli\src\types.ts)
- [F:\enterprise-workspace\projects\axi-app-cli\src\features\catalog.ts](F:\enterprise-workspace\projects\axi-app-cli\src\features\catalog.ts)

## 3. 当前主要缺口

虽然底座已经在，但离“产品化 v1”还有几个明显缺口。

### 3.1 CLI 启动层仍然过厚

[F:\enterprise-workspace\projects\axi-app-cli\src\cli.ts](F:\enterprise-workspace\projects\axi-app-cli\src\cli.ts) 目前直接静态导入 `runCli`。

这意味着：

- `--version`
- `--help`
- `list`
- `doctor`

这些轻量路径，仍要先付出主运行时的模块加载成本。

### 3.2 contribution 模型还不够一等公民

当前已有通用 `ScaffoldModuleContribution`，但 runtime 仍然保留了主题专用 helper：

- [F:\enterprise-workspace\projects\axi-app-cli\src\features\catalog.ts](F:\enterprise-workspace\projects\axi-app-cli\src\features\catalog.ts)
- [F:\enterprise-workspace\projects\axi-app-cli\src\types.ts](F:\enterprise-workspace\projects\axi-app-cli\src\types.ts)

这说明系统已经开始 contribution 化，但还没有完全进入：

- typed contribution families
- phase-aware assembly
- visibility / execution / persistence 分层

### 3.3 生命周期模型还偏隐式

`init/create/add/sync/list/doctor` 已经存在，但 phase 与 command class 更多是代码组织结果，而不是正式 runtime contract。

这会影响：

- 后续命令扩展
- warmup / profiling / early input 这类能力挂载
- repair 与 mutation 的边界清晰度

### 3.4 模块系统仍以“文件生成”为主

现在的模块很强，但主要还是：

- 生成模板
- 生成文档
- 生成脚本

而不是更广义的能力贡献者。要对齐 PRD，模块后续还要能贡献：

- command
- doctor check
- sync transform
- warmup
- policy

### 3.5 产品化体验还没有系统化

当前 CLI 已能用，但还没有把这些体验明确建成能力：

- 快路径优化
- 长流程 phase 叙事
- 结构化错误输出
- 启动 profiling
- 可选 interactive runtime 增强

## 4. 总体策略

v1 的实现不应推翻现有代码，而应沿当前架构做“收紧和升级”。

总体策略分三条：

1. 保留现有命令面与三层模块底座  
   不做破坏性重写。

2. 逐步把“特殊逻辑”收敛成 runtime contract  
   让模块和命令都围绕统一生命周期运作。

3. 先巩固 v1 的产品稳定性，再上更重的体验优化  
   比如启动预热、early input、startup profiler 这类增强，应先以 foundation capability 形态设计，再决定何时默认启用。

## 5. 实施工作流

v1 建议拆成 5 个工作流并行推进，但要按依赖顺序收口。

### 5.1 工作流 A：运行时核心收紧

目标：

- 明确 phase
- 明确 command class
- 明确 policy / snapshot / applied runtime 的职责

产出：

- runtime lifecycle contract
- command dispatch contract
- scaffold/apply/sync/repair 的统一执行骨架

优先级：最高

### 5.2 工作流 B：模块与 contribution 升级

目标：

- 把模块从“模板片段容器”升级成“能力贡献者”
- 去掉核心层对个别模块能力的特殊理解

产出：

- typed contribution families
- contribution resolver
- module manifest contract 稳定化

优先级：最高

### 5.3 工作流 C：CLI 产品面增强

目标：

- 快路径足够快
- 重路径有 phase 叙事
- inspection / mutation / repair 行为一致

产出：

- thin bootstrap
- dynamic import dispatch
- 统一输出 contract
- error/exit semantics 收紧

优先级：高

### 5.4 工作流 D：生成项目与设计系统收紧

目标：

- 让生成产物继续保持开箱即用
- 让 token / SCSS / feature-based 结构继续稳定

产出：

- token domain 粒度收紧
- SCSS 消费树稳定
- 文档模板继续对齐 PRD/TDD/模块系统

优先级：高

### 5.5 工作流 E：验证与修复能力收紧

目标：

- repair 有边界
- doctor 可依赖
- 测试能锁住架构

产出：

- drift / repair 测试矩阵
- managed file ownership 策略
- JSON 输出回归测试

优先级：高

## 6. 分阶段落地

### Phase 1：Runtime Baseline Harden

目标：

- 稳住 v1 核心心智模型
- 把现有能力正式纳入 runtime contract

核心动作：

- 明确 command classes：inspection / mutation / repair
- 明确 runtime phases
- 明确 policy/snapshot 的读写时机
- 为 future contributions 定义装配接口

完成标准：

- 不改用户命令面也能说明整套 runtime
- `list / doctor / sync / add` 的边界在代码中清晰可见

### Phase 2：Contribution Runtime

目标：

- 让模块真正通过贡献协议扩展系统

核心动作：

- 建立 typed contribution registry
- 将特化 helper 收敛为 contribution resolver
- 为 command/doc/template/check/warmup 等能力准备统一接入口

完成标准：

- 新模块接入时，不需要给核心 runtime 加一段专门的 if/else

### Phase 3：Productized CLI Surface

目标：

- 让 CLI 体验配得上“产品”而不是“工具集合”

核心动作：

- 把 [F:\enterprise-workspace\projects\axi-app-cli\src\cli.ts](F:\enterprise-workspace\projects\axi-app-cli\src\cli.ts) 改造成 thin bootstrap
- 快路径零或低成本返回
- 按命令动态装配运行模块
- 输出格式、错误格式、退出码统一

完成标准：

- `--help`、`--version`、inspection 路径体感足够轻
- mutation 路径拥有一致阶段叙事

### Phase 4：Scaffold Output Hardening

目标：

- 确保生成产物既稳定又可扩展

核心动作：

- token domain 继续细分
- SCSS 文件树继续稳定
- 文档模板对齐新 runtime 与模块模型
- optional/experimental 模块产物边界明确

完成标准：

- 生成项目的结构与规则可以直接支撑下一轮能力扩展

### Phase 5：Release Readiness

目标：

- 锁住 v1 的产品质量

核心动作：

- 覆盖命令矩阵测试
- drift / repair / stale file 测试
- JSON contract 测试
- 文档一致性检查

完成标准：

- v1 的命令、状态和模块协议足够稳定，可继续在其上迭代

## 7. 建议交付顺序

建议按下面顺序推进，而不是并行乱铺：

1. runtime baseline
2. contribution runtime
3. CLI bootstrap/product surface
4. scaffold output hardening
5. verification and release gate

原因很简单：

- runtime contract 不稳，后面的命令体验和模块扩展都没有稳定地基
- contribution model 不稳，越往后越容易把特殊逻辑继续写死
- 先收紧 runtime，再做体验优化，返工最少

## 8. 风险与应对

### 风险 1：过早追求体验细节，忽略运行时边界

表现：

- 提前做 early input / prewarm / profile
- 但 runtime 还没有正式 phase contract

应对：

- 先把它们定义成 future foundation contributions
- 不先做默认启用

### 风险 2：模块越多，核心 runtime 越懂业务

表现：

- runtime 出现越来越多的模块专用 helper

应对：

- 强制新能力走 contribution family
- 核心只理解 contract，不理解具体主题或组件语义

### 风险 3：repair 能力越做越危险

表现：

- `doctor --fix` 开始越权处理非受管内容

应对：

- fix 只处理 managed scope
- 明确告警不可自动修的内容

### 风险 4：文档与真实实现脱节

表现：

- PRD、implementation plan、runtime spec 各说各话

应对：

- 每次核心结构调整都同步文档
- 让测试覆盖关键 contract

## 9. v1 发布门槛

满足以下条件，才算 Axi CLI v1 达到“可用版本”标准：

- 命令面稳定
- 三层模块模型稳定
- policy / snapshot / sync / doctor 心智稳定
- 生成产物可用且可继续演进
- JSON 输出可供自动化依赖
- repair 有明确边界
- PRD、架构文档、README 保持一致

## 10. 下一步建议

本计划之后，建议立刻进入两份执行性文档：

- 工程任务拆解
- 版本发布检查单

其中工程任务拆解用于代码实施，发布检查单用于冻结 v1 质量门槛。
