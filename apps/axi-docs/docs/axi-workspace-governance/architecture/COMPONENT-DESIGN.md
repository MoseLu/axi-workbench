---
id: component-workspace-architecture
title: 工作区架构可视化组件
type: component
status: draft
tags: [workspace, architecture, visualization, force-graph]
created: 2026-08-22
---

# WorkspaceArchitecturePage

工作区架构可视化页面，支持 4 种视图切换：
1. **全架构** - 6 大架构层完整视图
2. **数据流转** - 从真源到消费方的 5 步链条
3. **项目准入** - 新建/修改前的 5 步门槛
4. **修改触发** - 改一处触发整个工作区的连锁反应

## Props

```typescript
interface WorkspaceArchitecturePageProps {
  onNavigateToDocument?: (path: string) => void
}
```

## 实现要点

1. 使用现有的 `GlobalGraph` 组件展示力导向图
2. 实现视图切换 Tabs
3. 渲染架构卡片（类似原 HTML 的 `module` 和 `sub` 样式）
4. 支持点击展开/折叠
5. 与现有文档系统集成，可点击跳转到对应文档
