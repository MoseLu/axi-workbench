---
name: axi-docs-components
description: Axi Docs 组件库的架构规则和开发指南
---

# Axi Docs Components AGENTS.md

> 本文件定义 Axi Docs 组件库的架构规则。所有组件变更必须符合本文件的设计原则和模式。

---

## 组件库概述

Axi Docs 组件库提供可复用的 UI 组件，用于构建文档浏览和知识图谱可视化界面。

---

## 组件目录结构

```
src/components/
├── BlinkoView.tsx          # Blinko 视图组件
├── DocumentView.tsx        # 文档查看器
├── ErrorBoundary.tsx       # 错误边界
├── FileTree.tsx            # 文件树组件
├── Header.tsx              # 头部导航
├── Header.test.tsx         # Header 测试
├── Icons.tsx              # 图标组件
├── Icons.test.tsx          # Icons 测试
├── KnowledgeGraph.tsx      # 知识图谱
├── KnowledgePanel.tsx      # 知识面板
├── SearchResults.tsx       # 搜索结果
├── Sidebar.tsx            # 侧边栏
└── TableOfContents.tsx     # 目录表
```

---

## 组件设计原则

### 1. 单一职责

每个组件只做一件事：
- **FileTree** - 负责文件树的展示和交互
- **DocumentView** - 负责 Markdown 文档的渲染
- **KnowledgeGraph** - 负责知识图谱的可视化

### 2. 可组合性

组件应该可以组合使用：
```tsx
<Sidebar>
  <FileTree />
</Sidebar>

<DocumentView>
  <TableOfContents />
  <MarkdownContent />
</DocumentView>
```

### 3. 可测试性

每个组件必须有对应的测试文件：
- `ComponentName.tsx` → `ComponentName.test.tsx`
- 测试覆盖率要求：> 70%

### 4. 类型安全

使用 TypeScript 严格模式：
```typescript
interface Props {
  title: string;
  content: string;
  onEdit?: () => void;
  className?: string;
}
```

---

## 核心组件说明

### Header

**职责**：应用头部导航和用户信息

**Props**：
```typescript
interface HeaderProps {
  title: string;
  currentPath?: string;
  onSearch?: (query: string) => void;
  className?: string;
}
```

**关键功能**：
- 显示应用标题
- 提供搜索框
- 显示当前路径

### FileTree

**职责**：文件树展示和导航

**Props**：
```typescript
interface FileTreeProps {
  files: FileNode[];
  selectedPath?: string;
  onSelect?: (path: string) => void;
  className?: string;
}
```

**关键功能**：
- 递归渲染文件树
- 支持折叠/展开
- 高亮选中文件

### DocumentView

**职责**：Markdown 文档渲染

**Props**：
```typescript
interface DocumentViewProps {
  content: string;
  title?: string;
  className?: string;
}
```

**关键功能**：
- Markdown 渲染（使用 `react-markdown`）
- 代码高亮
- 表格支持
- 响应式布局

### KnowledgeGraph

**职责**：知识图谱可视化

**Props**：
```typescript
interface KnowledgeGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick?: (node: GraphNode) => void;
  className?: string;
}
```

**关键功能**：
- 2D 力导向图（使用 `react-force-graph-2d`）
- 节点点击事件
- 缩放和平移

### SearchResults

**职责**：搜索结果展示

**Props**：
```typescript
interface SearchResultsProps {
  results: SearchResult[];
  onItemClick?: (path: string) => void;
  className?: string;
}
```

**关键功能**：
- 列表展示搜索结果
- 高亮匹配关键词
- 支持分页

---

## 组件开发规范

### 文件命名

- 使用 PascalCase：`MyComponent.tsx`
- 测试文件：`MyComponent.test.tsx`

### Props 定义

```typescript
// ✅ 好的做法
interface MyComponentProps {
  title: string;
  description?: string;  // 可选 props
  onSubmit: (data: FormData) => void;  // 回调函数
  className?: string;  // 支持样式定制
}

// ❌ 不好的做法
interface MyComponentProps {
  data: any;  // 使用 any 类型
  handleClick: () => void;  // 使用 onClick 命名
}
```

### 默认 Props

```typescript
const MyComponent: React.FC<MyComponentProps> = ({
  title,
  description = '',  // 默认值
  className = '',
}) => {
  return <div className={className}>...</div>;
};
```

### 样式处理

优先使用 Tailwind CSS：
```tsx
<div className="p-4 bg-white rounded-lg shadow-md">
  Content
</div>
```

或者使用 CSS Modules：
```tsx
import styles from './MyComponent.module.css';

<div className={styles.container}>Content</div>
```

---

## 测试规范

### 测试模板

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('calls callback on click', () => {
    const handleClick = jest.fn();
    render(<MyComponent onClick={handleClick} />);
    // ... 交互测试
  });

  it('displays error message', () => {
    render(<MyComponent error="Test error" />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
});
```

### 测试覆盖率

每个组件必须测试：
- [ ] 正常渲染
- [ ] Props 变化响应
- [ ] 用户交互（点击、输入等）
- [ ] 错误状态

---

## 错误处理

使用 ErrorBoundary 捕获组件错误：

```tsx
<ErrorBoundary fallback={<div>出错了</div>}>
  <MyComponent />
</ErrorBoundary>
```

---

## 性能优化

### React.memo

对于纯展示组件，使用 `React.memo` 避免不必要的重渲染：

```typescript
const MyComponent = React.memo<MyComponentProps>(({ title }) => {
  return <div>{title}</div>;
});
```

### useCallback

对于回调函数，使用 `useCallback` 缓存：

```typescript
const handleClick = useCallback(() => {
  // ...
}, [dependencies]);
```

### useMemo

对于计算结果，使用 `useMemo` 缓存：

```typescript
const filteredData = useMemo(() => {
  return data.filter(item => item.active);
}, [data]);
```

---

## 依赖规则

- **不依赖**：`src/mcp/`、`src/services/`（业务逻辑）
- **可依赖**：`src/types/`、`src/config/`（类型和配置）
- **样式**：使用 Tailwind CSS 或 CSS Modules
- **图标**：使用 `Icons.tsx` 组件

---

## 可访问性 (A11y)

- 使用语义化 HTML 标签
- 为交互元素添加 `aria-label`
- 支持键盘导航
- 提供焦点状态

---

## 常见任务

### 创建新组件

```bash
# 1. 创建组件文件
touch src/components/MyComponent.tsx

# 2. 创建测试文件
touch src/components/MyComponent.test.tsx

# 3. 编写代码和测试
# 4. 在主应用中导入使用
```

### 更新现有组件

1. 找到对应的测试文件
2. 先更新测试用例
3. 再更新组件代码
4. 验证测试通过

### 调试组件

- 使用 React DevTools
- 添加 `console.log` 或使用 `debugger`
- 检查 Props 是否正确传递

---

## 参考文档

- [React 文档](https://react.dev)
- [Testing Library 文档](https://testing-library.com)
- [Tailwind CSS 文档](https://tailwindcss.com)

---

*最后更新：2026-03-26*
