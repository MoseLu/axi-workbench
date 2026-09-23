# PRD — Workbench 空间化工作区思维导图重构

> 状态：Draft v0.1（需求整理版）  
> 日期：2026-09-24  
> 产品：Axi Workbench Web 管理控制中心  
> 来源：对话《workbench - 思维导图重构》及其中的 `axi-personal-os-architecture.html` 原型讨论  
> 目标版本：Spatial Graph V1（先完成可进入、可探索的 2.5D 图谱，再做视觉增强）

## 1. 一句话定义

将 Workbench 当前“可操作的 SVG 架构图”升级为一个以真实工作区图谱为数据源、支持层级展开、镜头聚焦、语义缩放和关系探索的 **Workspace Spatial Graph**：用户不是在查看一张图，而是在进入并探索工作区。

## 2. 背景与问题

### 2.1 背景

Workbench 已经具备工作区中心、一级域、结构归属线、关系线和右侧详情面板等骨架，方向已经从普通 Dashboard 进入“Mind Map × Knowledge Graph”。现有原型能够表达工作区有哪些域、项目节点以及部分关系，但空间体验仍不足以支撑“进入一个项目并继续探索其内部架构”的产品定位。

### 2.2 当前主要问题

1. **展开像显示，不像出生**：子节点初始已经固定在画布上，仅通过 `opacity` 切换可见性；用户感知不到节点从父节点内部生成。
2. **层级深度不足**：当前主要覆盖 `Workspace → 一级域 → 项目`，项目内部的 Domain、Registry、Persistence、Docs、Skills 等结构还没有成为可探索的真实子图谱。
3. **布局依赖手工坐标**：节点和曲线使用写死的 `translate(x y)` 与 `d` 路径；节点数量增长后无法维护，也无法适应真实图谱变化。
4. **节点仍是圆点**：颜色可以表达状态，但实体类型、数量、健康度和关键事实不够可识别，节点还没有成为 Workspace Entity。
5. **镜头缺少进入感**：点击节点目前更像移动整张 SVG；缺少背景退后、上下文淡出、目标放大、连接线生长和子图谱展开等镜头语言。
6. **视觉增强优先级失焦**：星空、粒子、3D、玻璃和 Three.js 容易制造“炫的静态关系图”，但不能替代层级、布局和导航能力。

## 3. 产品目标

### 3.1 目标

- **G1 — 真实层级探索**：用户可从 Workspace 进入一级域、项目和项目内部结构，至少完成三层图谱探索。
- **G2 — 空间化导航**：点击节点后产生可理解的“进入节点”体验，包括 Camera Focus、Context Fade、目标放大、子节点生长和关系线同步展开。
- **G3 — 数据驱动布局**：前端渲染只消费图谱实体和关系，不依赖业务代码手工指定最终坐标；布局引擎负责计算位置。
- **G4 — 图谱可读性**：不同实体类型具备稳定的视觉语言，节点能够表达类型、名称、状态和关键摘要。
- **G5 — 保留管理效率**：搜索、筛选、详情面板和关系查看继续作为 HTML UI 层存在，不把所有界面内容塞进 Canvas。
- **G6 — 可渐进交付**：V1 先以 2.5D 和 SVG 为主，支持后续扩展到更大规模节点、粒子背景、路径高亮和 WebGL，而不提前锁死 Three.js。

### 3.2 成功标准

用户第一次点击 `Projects` 时，能明显感知自己“进入了 Projects”；点击 `axi-soul-world` 后，能继续看到该项目内部结构，而不是只看到一张被平移的总图。产品价值以探索效率和空间理解为先，视觉冲击力为后。

## 4. 非目标

- V1 不直接建设真正的 3D 星空、VR/AR、Three.js 场景或 WebGL 全量渲染。
- V1 不以粒子、玻璃、景深和发光效果替代数据模型、布局和交互。
- 不把所有节点做成复杂卡片；节点信息密度应随层级和语义缩放渐进出现。
- 不重做右侧详情面板的基础范式；在现有 Selected Node 信息结构上增量丰富。
- 不改变 Workbench Web、Mobile、DevSvc Host 和专业工具的产品边界。
- 不把工作区其他项目的实现代码、私有 schema 或绝对路径硬编码进 Workbench 前端。

## 5. 目标用户与核心任务

| 用户 | 核心问题 | 期望任务 | 成功结果 |
| --- | --- | --- | --- |
| 平台 Owner / 系统管理员 | 工作区整体由哪些域和项目组成？ | 浏览全局、进入域、查看健康度和项目摘要 | 能快速形成工作区全貌并定位异常域。 |
| 项目负责人 | 某个项目内部由哪些能力组成？ | 进入项目、查看内部层级、查看关系与关键事实 | 不依赖目录跳转即可理解项目结构。 |
| 开发者 / Agent | 一个实体依赖谁、被谁使用、状态如何？ | 选择节点、查看 relations、沿关系进入关联实体 | 以图谱路径完成定位和上下文收集。 |
| 运维/治理角色 | 哪些节点需要关注？ | 按状态/类型筛选、聚焦 Warning/Unhealthy、查看详情 | 异常节点优先暴露，但不破坏全局上下文。 |

## 6. 产品原则

1. **先数据与层级，后特效**：优先投入真实展开、节点生长、Camera/Semantic Zoom。
2. **节点是实体，不是装饰**：每个节点应有稳定 id、类型、父子关系、状态和可选事实。
3. **位置由布局产生**：业务数据描述“是什么、属于谁、连接谁”，不描述“固定放在 x/y”。
4. **DOM 与 Graph 分层**：可访问、可检索、可编辑的 UI 使用 DOM；节点、边和动画使用 SVG/Canvas。
5. **空间导航不能牺牲可用性**：任何时候都应有明确的当前焦点、返回上级、重置视图和详情入口。
6. **语义缩放优于无限缩放**：缩放不仅改变大小，也改变展示的实体粒度和信息密度。
7. **规划与事实分开**：工作区图谱的真实数据、缓存快照和 UI 视图状态必须有清晰边界。

## 7. V1 范围

### 7.1 首发图谱

V1 最小闭环覆盖以下三层：

```text
Workspace
├── Projects
│   ├── axi-kernel
│   ├── axi-workbench
│   └── axi-soul-world
├── Products
├── Runtime
├── Governance
├── Shared
├── Tools
└── Resources
```

至少需要为 `axi-kernel`、`axi-workbench`、`axi-soul-world` 提供可继续展开的第三层示例数据；第三层应来自真实或明确标记为 fixture 的项目内部实体，不得只靠视觉占位假装已接入真实数据。

### 7.2 V1 必须具备的七项交互

1. Workspace 中心节点呼吸/轻微活性反馈。
2. 一级节点从 Workspace 逐步展开。
3. 点击一级域后 Camera 聚焦该节点。
4. 目标域的子节点从父节点位置向目标位置弹簧展开。
5. 点击项目后展开第三层内部结构。
6. Hover 节点轻微放大并显示 glow/tooltip。
7. 结构归属线与关系线支持 Bezier 曲线；关系线可有克制的流动反馈。

### 7.3 V1 交互基础

- 画布拖拽 Pan。
- 滚轮/触控板 Zoom。
- 点击节点 Select。
- 双击或明确的进入动作 Focus/Enter。
- 展开/收起节点及其子图谱。
- 重置视图、返回上级和回到当前焦点。
- 右侧详情面板跟随当前选中节点。
- 关系类型可区分结构归属、uses、provides、invokes 等语义。

## 8. 后续版本范围

以下能力不进入 V1 的首要验收，但应在模型和渲染边界上预留：

- 3D tilt、parallax、背景景深和更丰富粒子流。
- minimap。
- 搜索定位、关系过滤、路径高亮。
- 节点视图与列表/面板视图切换。
- 更高层级的 Semantic Zoom：Workspace → Project → Architecture → Document/Rule/Class/API。
- 大规模图谱优化：虚拟化、分层渲染、Canvas/WebGL、增量布局和视口裁剪。

## 9. 信息架构与用户流程

### 9.1 全局探索流程

```text
打开 Workspace Graph
  → 查看 Workspace 中心与一级域
  → Hover 查看摘要
  → 点击 Projects
  → Camera 进入 Projects
  → 子项目从 Projects 内部生长出来
  → 选择 axi-workbench
  → 详情面板显示项目摘要
  → 进入项目内部第三层
  → 沿结构归属或关系线继续探索
```

### 9.2 返回与上下文流程

- 当前焦点始终可见，并在画布和详情面板中保持一致。
- 返回上级时，子图谱收回父节点，镜头回到上一级上下文。
- 重置视图恢复全局 Workspace 视角，不清除当前数据筛选。
- 详情面板可查看当前节点的 Overview、Architecture、Docs、Relations 等信息；这些是面板内的详情视图，不等同于图谱层级本身。

### 9.3 异常节点流程

```text
全局视图看到 Warning/Unhealthy 标识
  → 筛选或点击异常节点
  → Camera 聚焦并保留最小上下文
  → 详情面板展示状态、关键事实、最近变更和关系
  → 沿关系进入上游/下游节点
```

## 10. 图谱数据模型

### 10.1 数据源原则

`workspace.graph.json` 是当前最符合产品意图的候选权威数据源方向，但在实现前必须核验其现有 schema、生成方式、快照新鲜度及前端可消费边界。若现有工作区注册表与图谱文件承担不同职责，应通过明确的 Graph View Model 或适配层组合，不在 UI 中直接拼接多个事实源。

### 10.2 节点模型

```ts
type GraphNode = {
  id: string;
  type: 'workspace' | 'domain' | 'project' | 'product' | 'runtime'
    | 'governance' | 'shared' | 'tool' | 'resource'
    | 'document' | 'skill' | 'agent' | 'service' | 'api';
  name: string;
  parentId?: string;
  status?: 'healthy' | 'warning' | 'unhealthy' | 'unknown';
  summary?: string;
  facts?: Array<{ label: string; value: string }>;
  childCount?: number;
  sourceRef?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
};
```

约束：节点数据只描述实体及其事实，不包含最终屏幕坐标；`sourceRef` 用于保留事实来源或注册表关联，不能把本地绝对路径当成产品合同。

### 10.3 关系模型

```ts
type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'uses' | 'provides' | 'invokes' | 'depends-on' | 'related';
  directed?: boolean;
  status?: 'healthy' | 'warning' | 'unknown';
  label?: string;
  metadata?: Record<string, unknown>;
};
```

- `contains`：结构归属，默认实线、默认参与层级布局。
- `uses` / `provides` / `invokes` / `depends-on`：语义关系，默认虚线或不同视觉编码。
- `related`：弱关系，默认低强调，避免污染主层级。

### 10.4 图谱视图状态

图谱事实与视图状态分离：

```ts
type GraphViewState = {
  focusNodeId: string;
  selectedNodeId?: string;
  expandedNodeIds: string[];
  camera: { x: number; y: number; scale: number };
  filters: { types?: string[]; statuses?: string[]; relationTypes?: string[] };
};
```

视图状态可保存在页面会话或用户偏好中，但不写回工作区事实源。

## 11. 视觉与渲染架构

### 11.1 分层结构

```text
UI Layer
  搜索 / Filter / 面包屑 / Detail Panel / 操作提示
Graph Overlay
  Tooltip / Node label / Focus ring / Selection state
Graph Renderer
  Nodes / Edges / Arrow / Animation / Hit testing
Background
  Grid / subtle glow / optional depth cues
```

### 11.2 技术路线

V1 采用 React + SVG 为主的 2.5D 实现：

- DOM：工具栏、搜索、筛选、详情面板、可访问文本、tooltip 容器。
- SVG：节点、Bezier 关系线、箭头、路径生长和可控动画。
- CSS：颜色、glow、呼吸、过渡、状态视觉。
- Canvas：仅在粒子或节点数量达到明确性能阈值后评估，不作为 V1 默认渲染器。
- Graph Layout：独立于 React 组件，输入实体/关系和视图约束，输出布局结果。
- Animation：独立的 transition state，不通过简单 `hidden/opacity` 切换冒充进入动画。

### 11.3 节点视觉语言

首版不要求复杂卡片，但必须让实体类型可识别：

| 实体类型 | 建议视觉语言 | 最小信息 |
| --- | --- | --- |
| Workspace | 中心核心节点 | 名称、整体状态 |
| Domain / Project | 几何节点或轻量实体卡 | 名称、状态、数量摘要 |
| Document | Sheet/文档形态 | 名称、文档状态 |
| Skill | Hexagon/技能形态 | 名称、可用性 |
| Resource | Orb/资源形态 | 名称、健康度 |
| Runtime / Service | Gear/运行形态 | 运行状态、最近变更 |
| Governance | Shield/治理形态 | 规则/审计状态 |
| Agent | Spark/代理形态 | 执行状态或能力摘要 |

状态色必须与现有 Workbench 语义色保持一致；形状表达类型，颜色表达状态，不能反过来。

## 12. 动画与镜头规范

### 12.1 节点生长

展开子节点时：

1. 子节点初始坐标等于父节点坐标，或位于父节点内部的起始锚点。
2. 节点通过 spring/easing 移动到布局目标位置。
3. 对应连接线从 0% 生长到 100%。
4. 标签和次要信息延迟出现，避免所有元素同时跳出。
5. 收起时沿相反路径回收，而不是立即隐藏。

### 12.2 Camera Focus

点击进入节点时，镜头动画至少包含：

- 目标节点向视口中心移动。
- 目标节点明显放大。
- 上下文节点降低透明度或对比度，但不能完全丢失方向感。
- 背景和上级节点轻微退后/虚化。
- 子节点从目标节点内部向外展开。
- 目标相关关系线提升强调度。

实现上可使用 `translate + scale + opacity + blur` 的组合，不要求真正 3D 相机。

### 12.3 Semantic Zoom

| 缩放层级 | 主要内容 |
| --- | --- |
| 1.0x | Workspace 与一级域全局关系 |
| 1.8x | 当前域与项目节点 |
| 3.0x | 当前项目与 Domain/Registry/Persistence/Docs/Skills 等内部结构 |
| 5.0x | 更细的 Document/Rule/Class/API 等实体，前提是数据源可提供 |

缩放阈值应由可读性和节点密度共同决定，不能只按硬编码倍率切换。

## 13. 布局引擎要求

### 13.1 约束

- 支持树状层级的稳定布局。
- 支持结构边与非结构关系边共存。
- 在展开/收起时尽可能保持已存在节点的位置稳定，减少跳动。
- 支持父节点中心锚点、子节点扇出、同层间距和视口边界。
- 支持从全局视角到局部视角的渐进布局。
- 布局结果可缓存或复用，但缓存不能成为事实源。

### 13.2 规模预期

设计上预留以下增长量：

```text
Project × 30
Skill × 120
Document × 500
Resource × 200
Relation × 1600
```

V1 不要求在该规模达到最终性能目标，但必须避免把手工坐标和单个 SVG path 作为不可替换架构。达到规模阈值后应有性能探测和渲染策略切换点。

## 14. 详情面板要求

现有详情面板范式继续保留，首版只扩充数据：

```text
AXI-KERNEL
Semantic Core
● Healthy

Overview | Architecture | Docs | Relations

Repository      projects/axi-kernel
Git              main · clean
Documents        17
Relations        12
Last Change      2h ago
```

最低字段：选中节点、名称、描述、状态、关键事实、关系摘要、最近变更（若数据源提供）和图谱操作提示。面板内容必须标示事实更新时间或未知状态，不能用静态占位数据伪装实时数据。

## 15. 需求验收标准

### 15.1 功能验收

- [ ] 打开图谱后能看到 Workspace 中心和一级域，且数据来自图谱模型而不是 JSX 中散落的节点定义。
- [ ] 点击 `Projects` 后，镜头进入 Projects，父级上下文退后，子节点从父节点位置生长到布局位置。
- [ ] 点击 `axi-kernel`、`axi-workbench`、`axi-soul-world` 中任一项目，可展开第三层子图谱。
- [ ] 子节点展开同时驱动对应边的生长动画；收起时节点和边回收。
- [ ] 支持 Pan、Zoom、Select、Focus/Enter、Collapse、Reset、Back。
- [ ] 点击节点后详情面板显示对应实体的信息，并与图谱选中态保持一致。
- [ ] 结构归属关系与语义关系具有可区分的视觉编码。
- [ ] Hover 节点有轻微放大、强调或 tooltip 反馈，且不改变布局事实。
- [ ] 关键节点在键盘或辅助技术可访问范围内；SVG 交互不能成为唯一信息入口。

### 15.2 数据与架构验收

- [ ] 节点位置由布局引擎计算，业务数据不要求维护最终 x/y。
- [ ] Graph Data、Layout Result、View State、Animation State 四者边界清晰。
- [ ] 图谱事实源、适配层和 fixture 数据有明确标识；fixture 不得冒充生产事实。
- [ ] 关系类型至少覆盖 `contains`、`uses`、`provides`、`invokes`。
- [ ] 图谱层与 HTML UI 层可独立演进；右侧详情、搜索和筛选不依赖 Canvas 内部文字绘制。

### 15.3 体验验收

- [ ] 用户能感知“进入节点”，而不是仅看到整张图平移。
- [ ] 展开节点的第一帧从父节点开始，不能只是从透明变为不透明。
- [ ] 三层探索过程中，当前焦点和返回路径始终清楚。
- [ ] 在无动画偏好或低性能环境下提供 reduced-motion/降级路径。
- [ ] 动画不阻塞选择、返回、详情查看等基本操作。

### 15.4 性能验收

- [ ] V1 fixture 在目标开发环境中打开、展开、聚焦和拖拽无明显卡顿。
- [ ] 视口外或低语义层级节点不会无条件承担高成本动画。
- [ ] 图谱规模增长时有可观测指标：节点数、边数、布局耗时、渲染耗时、交互帧率。
- [ ] 当 SVG 不再满足规模目标时，存在切换 Canvas/WebGL 或分层渲染的明确边界，而不是重写整个产品模型。

## 16. 里程碑与交付切片

### M0 — 数据和边界确认

- 核验工作区图谱/注册表的现有 schema、生成方式和可用实体。
- 确认 Workbench Web 当前图谱页面的 owner 文件和现有测试入口。
- 输出 Graph View Model、关系类型和三层 fixture/真实数据映射。

### M1 — 可运行低保真图谱

- Workspace → Projects → 三个项目三层数据。
- SVG 节点/边、Pan、Zoom、Select、详情面板。
- 布局引擎替代手工坐标。

### M2 — 空间进入体验

- Camera Focus、Context Fade、节点从父节点生长。
- 边同步生长、收起回收、Back/Reset。
- reduced-motion 降级。

### M3 — 实体化节点与语义缩放

- 类型形态、状态语义、关键摘要。
- Semantic Zoom 与项目内部第三层真实内容。
- 关系类型筛选和路径基础高亮。

### M4 — 规模与视觉增强

- 性能探测、视口裁剪、分层渲染。
- minimap、搜索定位、parallax、粒子流等按数据和性能结果择优加入。
- 必要时评估 Canvas/WebGL/Three.js，而不是预先引入。

## 17. 技术验证与测试计划

### 单元/合同测试

- Graph Node/Edge schema 解析与必填字段。
- 关系类型到视觉编码的映射。
- Layout Engine：空图、单节点、三层树、关系交叉和收起稳定性。
- Camera transform：focus、back、reset 和边界缩放。
- Semantic Zoom 阈值与可见节点集合。
- reduced-motion 下动画状态直接完成且交互结果一致。

### UI 行为测试

- Workspace 初始视图。
- 点击 Projects 后的焦点、展开节点和生长边。
- 点击项目后的第三层探索。
- 选中节点与详情面板同步。
- Pan/Zoom/Back/Reset。
- 筛选/关系强调不破坏层级结构。

### 浏览器与视觉验证

- 在 Workbench Web 实际运行环境中验证，不以静态 CSS/构建产物代替用户可见验收。
- 记录桌面宽屏、窄窗口和 reduced-motion 三种状态。
- 若桌面 Tauri 复用该 Web UI，再单独验证已安装应用，不把浏览器证据当作桌面交付证据。

## 18. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 图谱事实源尚未稳定 | UI 可能建立在过期或重复数据上 | M0 先核验 schema、owner、刷新策略和适配边界。 |
| 布局引擎与动画互相干扰 | 展开时节点跳动、镜头失控 | 将 layout snapshot 与 transition snapshot 分开；动画结束后再提交稳定布局。 |
| 关系边过多造成视觉噪声 | 用户无法辨认层级 | 默认只强调当前上下文关系，弱化非主关系，提供过滤。 |
| SVG 规模增长导致性能下降 | 大图谱无法交互 | 设定性能探测，采用视口裁剪、semantic culling、分层渲染和必要时 Canvas/WebGL。 |
| 过早加入视觉特效 | 看起来华丽但无法探索 | M1/M2 验收未通过前不进入星空、3D、粒子增强。 |
| 动画影响可访问性 | 用户无法理解或操作 | reduced-motion、键盘路径、DOM 文本镜像和明确的返回/重置。 |
| fixture 与真实数据混淆 | 误导用户对工作区状态的判断 | fixture 明确标识，详情面板展示来源/更新时间/未知状态。 |

## 19. 待决策项

这些问题不阻塞 PRD 进入评审，但在 M0 必须收敛：

1. `workspace.graph.json` 是否直接作为 V1 数据源，还是只作为注册表输入之一，由哪个适配层提供 Graph View Model？
2. 当前已有图谱页面的正式路由、组件 owner 和状态管理边界是什么？
3. `axi-kernel`、`axi-workbench`、`axi-soul-world` 的第三层真实实体由哪些 provider/contract 提供？
4. V1 目标节点规模、最低设备/浏览器范围和帧率目标是多少？
5. “进入节点”采用单击、双击还是单击选择 + 二次进入动作？需要兼顾桌面和键盘可访问性。
6. 状态、最近变更、Git 和文档数量等详情字段的权威来源及刷新频率是什么？
7. 是否需要把用户的展开节点、镜头和筛选偏好持久化，以及持久化的作用域是什么？

## 20. 追踪与证据边界

### 已从原对话确认的产品判断

- 目标产品是“可以进入的空间”，不是静态架构图。
- 第一阶段采用 2.5D，不要求立即引入 Three.js。
- 首要投入是层级展开、节点生长、Camera/Semantic Zoom。
- DOM 与 Graph 分层，右侧详情面板继续作为 HTML UI。
- 未来数据规模可能达到几十个项目、数百文档和上千关系，因此不能延续手工坐标架构。

### 仍需代码/运行时核验的事实

- 当前页面实际组件、路由和数据入口。
- 现有 SVG 节点/边实现是否已被其他页面或测试复用。
- 工作区图谱文件的当前 schema、生成链路和新鲜度。
- 真实项目内部结构是否已经有可消费的 API/registry/contract。
- 浏览器和 Tauri 安装包中的实际交互性能。

本 PRD 不把上述待核验事项写成已完成能力；实现阶段必须将其转化为 M0 的调查结果、合同测试和运行时证据。

---

## 附录 A：V1 评审口径

评审人不应只问“页面是否更炫”，而应按以下顺序判断：

1. 是否看到了真实的 Workspace 层级？
2. 点击后是否真的进入了目标节点？
3. 子节点是否从父节点生长，而不是从透明变为可见？
4. 是否可以继续探索第三层内部结构？
5. 节点位置是否由数据和布局产生？
6. 详情、关系和状态是否可信且可追溯？
7. 在这些成立后，视觉特效是否提升了理解而不是制造噪声？

## 附录 B：推荐的首个可演示场景

```text
Workspace
  → 点击 Projects
  → 镜头推进，Workspace 退后，Projects 放大
  → axi-kernel / axi-workbench / axi-soul-world 从 Projects 内部生长
  → 点击 axi-soul-world
  → 展开 Documents / Source / Skills / Resources / Architecture
  → 选中 Architecture
  → 右侧详情面板展示名称、状态、关键事实和关系
  → 点击 Back 回到 Projects
  → Reset 回到 Workspace 全局
```

这个场景完成后，产品就从“可以操作的 SVG 架构图”跨过了“可进入的 Workspace Spatial Graph”的第一道门槛。
