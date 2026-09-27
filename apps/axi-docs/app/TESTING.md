# Axi Docs 测试套件

## 测试概览

本项目使用 [Vitest](https://vitest.dev) + [React Testing Library](https://testing-library.com/react) 进行测试。

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行一次（不监听）
pnpm test:run

# 生成覆盖率报告
pnpm test:coverage

# 运行统一质量门禁
pnpm quality:check

# 运行构建验证
pnpm verify
```

## 测试文件

### 1. 配置测试 - `src/config/sources.test.ts` (13 个测试)
测试文档源配置的正确性：
- `docSources` - 验证源配置完整性和唯一性
- `excludePatterns` - 验证排除模式
- `supportedExtensions` - 验证支持的文件扩展名

### 2. 服务测试 - `src/services/fileService.test.ts` (14 个测试)
测试文件服务层：
- `scanDirectory` - 目录扫描功能
- `readFile` - 文件读取功能
- `isExcluded` - 排除判断
- `isSupported` - 文件类型判断
- 错误处理和边界情况

### 3. 组件测试 - `src/components/Header.test.tsx` (11 个测试)
测试 Header 组件：
- 基本渲染
- 搜索输入和防抖
- 键盘事件（Enter、Escape）
- 刷新按钮
- 搜索清除功能
- 加载状态

### 4. 图标测试 - `src/components/Icons.test.tsx` (6 个测试)
测试 SVG 图标组件：
- RefreshIcon
- SearchIcon
- BookIcon
- FileIcon
- FolderIcon
- TagIcon

### 5. 同步测试 - `src/test/sync-blinko.test.ts` (11 个测试)
测试 Blinko 笔记同步功能：
- `noteToMarkdown` - 笔记转换为 Markdown
- Frontmatter 生成
- 附件和评论处理
- 边界情况处理

## 测试统计

```
Test Files: 5 passed (5)
Tests: 55 passed (55)
Duration: ~2.2s
```

## 覆盖率统计

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|---------
All files          |   14.00 |    75.00 |   51.28 |   14.00
sync-blinko.js     |   69.65 |    73.68 |     100 |   69.65
Header.tsx         |     100 |     92.3 |     100 |     100
Icons.tsx          |   49.64 |      100 |   42.85 |   49.64
sources.ts         |     100 |      100 |     100 |     100
fileService.ts     |     100 |      100 |     100 |     100
```

## 待添加测试

以下文件覆盖率较低，建议后续添加测试：

- `App.tsx` - 主应用组件
- `DocumentView.tsx` - 文档查看器
- `FileTree.tsx` - 文件树组件
- `BlinkoView.tsx` - Blinko 视图
- `Sidebar.tsx` - 侧边栏
- `SearchResults.tsx` - 搜索结果
- `TableOfContents.tsx` - 目录
- `fileService.node.ts` - Node.js 文件服务
- `mcp/server.ts` - MCP 服务器

## 测试最佳实践

1. **单元测试优先** - 先测试工具函数和服务
2. **组件行为测试** - 测试用户交互，而非实现细节
3. ** mocks 外部依赖** - 使用 vitest.mock() 模拟 fetch API
4. **覆盖率目标** - 目标 80%+ 覆盖率

## 持续集成

在 CI 环境中运行：

```bash
pnpm install
pnpm quality:check
pnpm verify
```
