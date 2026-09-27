# Axi Docs — 错误与复盘记录 (ERROR)

> 本文件记录在 `axi-docs` 及其所维护的 workspace 项目镜像中发生的
> **根因分析 (RCA) 与复盘**条目，目的是让"为什么这样改"在代码之外也有
> 一处可追溯的出口。每条记录应可独立阅读，并链接到对应的代码、测试、PR
> 或 commit。
>
> **本文件是 `ERROR.md` 的中文镜像；权威源为英文 `ERROR.md`**。

---

## 维护约定

### 触发场景

以下任一情况出现时，开一条新记录：

- 跨项目治理类缺陷（命名漂移、目录归属错误、注册表不一致）；
- 同型错误在超过一个工作会话 / PR 中重复出现；
- 修复涉及"读 / 写路径不一致"、"幽灵目录 / 文件"等结构性 bug；
- 修复后需要新增**长期守卫测试**锁住正确行为。

### 等级判定

| 等级 | 含义 | 典型表现 | 处置 |
|------|------|----------|------|
| `P0 — 必修` | 已造成生产功能缺失、数据丢失、安全风险，或阻塞关键工作流 | 工具读不到日志、build 失败、安全漏洞、配置漂移 | 当个工作会话内修复，必须新增守卫测试 |
| `P1 — 强烈建议` | 已造成能力退化、可观测性下降、跨项目体验不一致 | 日志不可读、文档过时、命名混乱但不阻塞 | 排进下一轮 sprint；可不带守卫但需写明处理计划 |
| `P2 — 经验性观察` | 暂未触发实际故障，但识别出的潜在风险 | 复杂度上升、约定未文档化、缺乏回归覆盖 | 登记作为"将来何时会咬人"的提醒 |

### 每条记录格式

每条记录应包含：现象、根因、修复、守卫（如有）、教训、相关五段。等级从 P0
到 P2 不可省略"教训"——哪怕只是经验性的观察也要写。

### 不记录

单元测试 / E2E 一次性失败、用户输入错误、网络抖动、第三方临时不可用
（这些走各自的运行日志，不进 ERROR 池）。

### 状态

`open` / `fixed` / `accepted-as-limitation`。`open` 状态需在条目末尾注明
"待办动作"和"预计处理窗口"。

### 编号

`<YYYY-MM-DD>-<两位序号>`（同一天内多条目递增）。同一条目升级等级（如
P2 升级到 P1）保留原编号，在末尾加 `[upgraded from P2 on YYYY-MM-DD]`
标记，**不**新开一条。

---

## 索引

| 等级 | 编号 | 标题 | 涉及项目 | 状态 | 日期 |
|------|------|------|----------|------|------|
| P0 | [2026-06-11-01](#2026-06-11-01) | ielts-vocab mac-app 日志目录单复数漂移与 read/write 不一致 | `products/ielts-vocab` | fixed | 2026-06-11 |

---

## P0 — 必修

<a id="2026-06-11-01"></a>

### 2026-06-11-01 — ielts-vocab mac-app 日志目录单复数漂移与 read/write 不一致

**优先级**：P0（导致 MCP `get_logs` 工具读不到运行时日志）  
**状态**：fixed  
**涉及项目**：`products/ielts-vocab`（即 `WORKSPACE_INDEX.md` 中登记的
"IELTS Vocabulary"）

#### 现象

- 跑 `bash scripts/run-mac-local-app.sh preview`（或 `dev`）时，Mac 桌面
  应用的 stdout / stderr 确实写到了 `logs/runtime/mac-app/preview.*.log`；
- 但通过 `packages/mac-bridge-mcp/server.py` 提供的 MCP `get_logs` 工具
  读取时，永远返回空内容；
- 进一步在 `/Volumes/code/projects/ielts-vocab/logs/runtime/mac-app/` 下
  发现了**项目外部**的幽灵副本（带 5 月底和 6 月初的 preview 日志）。

#### 根因

同一个日志目录在 ielts-vocab 项目内被**两套代码各写一个名字**：

| 角色 | 路径 | 文件 |
|------|------|------|
| 写入（launcher / Swift / bash） | `logs/runtime/mac-app/`（单数） | `scripts/run-mac-local-app.sh:252, 372, 459, 460, 498` |
| 读取（MCP bridge） | `logs/runtime/mac-apps/`（复数） | `packages/mac-bridge-mcp/server.py:31` |

复数 `mac-apps` 的来源是历史某次 typo（`IELTS_MAC_LOCAL_APP_DIR` 默认值
写成 `…/mac-apps`），后来 launcher 改成 `mac-app` 但 MCP 读取侧没同步。

幽灵目录 `/Volumes/code/projects/ielts-vocab/...` 来自更早一批以
`/Volumes/code/projects` 为 cwd 跑的预览任务（Swift 通过 `run.conf` 里的
`IELTS_LOCAL_APP_ROOT` 拿绝对路径，那批配置被回填之前落在了 cwd 相对路
径下）。当前 launcher 已经修好，新增的预览不再产生幽灵目录。

#### 修复

1. **代码**：把 `packages/mac-bridge-mcp/server.py:31` 的
   `MAC_APP_LOG_DIR` 改为 `…/mac-app`，与 launcher 写入路径对齐；
   同步把 `scripts/run-mac-local-app.sh:89` 的 `.app` bundle 默认输出目
   录也改成单数 `mac-app`，让脚本内目录名彻底自洽；
2. **磁盘**：把 `logs/runtime/microservices-mac/`（生产路径，42 个
   `*.err.log` / `*.out.log` / `*.pid`）按对齐方案 `git mv` 到
   `logs/runtime/app-services-mac/`，并相应修改
   `start-microservices.sh:39, 85` 与 `server.py:32`；
3. **清理**：删除孤儿 `logs/runtime/mac-apps/雅思词汇{开发,预览}版.app/`
   （旧的复数 `.app` bundle，1.8M × 2，ps 已确认无相关进程在跑）；
4. **守卫**：在 `backend/tests/test_mac_local_app_launcher.py` 新增两条
   测试，锁住 read/write 一致性以及 "app-services-mac" 是唯一被引用的
   应用服务目录名：
   - `test_mac_local_app_launcher_keeps_vite_inside_generated_app_bundle`
     解析 `MAC_APP_LOG_DIR = REPO_ROOT / …` 表达式，断言拼接后路径以
     `logs/runtime/mac-app` 结尾；
   - `test_microservice_log_dir_aligns_with_app_services_mac` 用
     `re + exec` 解析 `MICROSERVICE_LOG_DIR` 表达式，断言拼接后路径以
     `logs/runtime/app-services-mac` 结尾；并用
     `assert 'logs/runtime/microservices-mac' not in launcher` 禁止旧
     名复活。

#### 教训

- **read/write 两侧必须共用一个目录常量**，而不是在两个文件里各写一
  遍字符串。后续涉及"路径常量"的改动都要在 MCP / launcher / 文档三处
  同步搜索引用。
- **写日志的脚本应在脚本内显式 `cd "${root}"` 或注入绝对路径**，避免
  受调用方 cwd 影响。ielts-vocab launcher 后来通过 `run.conf` 注入
  `IELTS_LOCAL_APP_ROOT` 是正确做法，应在所有 spawn 子进程的启动脚本
  里复用同款模式。
- **同型 bug 的反向测试（"not in" 断言）成本极低收益极高**。本次两条
  守卫总计 < 30 行，未来如果再有人 typo `mac-app` → `mac-apps` 或
  把 `app-services-mac` 退回 `microservices-mac`，CI 会立刻爆红并
  指向 `f'expected …, got {dir!r}'` 的清晰错误信息。
- **扫描全 workspace 的"目录名漂移"模式应作为定期巡检项**。本次扫了
  13,299 个代码文件，发现只有 ielts-vocab 一处真问题；但 5 月底残留
  的孤儿 `mac-apps/` 目录说明这种问题历史上确实多次发生。

#### 相关

- `products/ielts-vocab/scripts/run-mac-local-app.sh`
- `products/ielts-vocab/start-microservices.sh`
- `products/ielts-vocab/packages/mac-bridge-mcp/server.py`
- `products/ielts-vocab/backend/tests/test_mac_local_app_launcher.py`
- `WORKSPACE_INDEX.md` 中 "IELTS Vocabulary" 行

---

## P1 — 强烈建议

> 此等级目前无条目。
>
> 候选方向：
> - `app/` 构建产物（`dist/`）的产物大小持续增长，但缺一份按页面/按
>   chunk 的体积追踪；
> - `docs/content/{en,zh}/` 的双语文档同步仍依赖人工巡检，没有自动
>   diff 守 卫。
>
> 当出现上述任一情况或类似级别的可观测性问题时，请按"维护约定"开新条
> 目放到本章节。

---

## P2 — 经验性观察

> 此等级目前无条目。
>
> 候选方向：
> - 启动脚本（`start-*.sh`）的 cwd 依赖性未做整体审计，部分脚本仍在
>   用 `${root}/...` 这种依赖调用方 cd 到项目根的相对路径写法；
> - 全 workspace 缺乏统一的"目录命名约定"文档（mac-app vs mac-apps、
>   services-mac vs app-services-mac 这类命名差异是临时协调出来的，
>   没有权威源）。
>
> 当识别到不会立即咬人但"迟早会咬人"的模式时，请按"维护约定"开新条
> 目放到本章节，并写明触发条件（例如"下次有新人加入项目时"）。