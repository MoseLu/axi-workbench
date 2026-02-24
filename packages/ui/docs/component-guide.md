# MPMS UI 组件使用指南

本指南介绍 MPMS UI 组件库的设计理念、组件分层架构以及如何使用 Design Token 系统进行主题定制。

## 组件分层架构

MPMS UI 组件库采用原子设计理念，将组件分为三个层级：

### 1. 原子组件（Atoms）

原子组件是 UI 的最小构建块，不可再分。

#### 万能原子组件（Universal Atoms）

万能原子组件具有跨所有使用场景一致的样式。样式由组件定义本身提供。

```tsx
import { Icon, IconButton, Logo } from '@mpms/ui';

// Icon - 图标组件
<Icon name="system-home" size={20} color="currentColor" />

// IconButton - 图标按钮组件
<IconButton
  icon={<Icon name="system-settings" />}
  tooltip="设置"
  active={false}
  onClick={() => console.log('clicked')}
/>

// Logo - 标识组件
<Logo text="我的应用" collapsed={false} />
```

#### 布局特定原子组件（Layout-Specific Atoms）

布局特定原子组件针对特定布局上下文定制样式。样式由父级分子组件通过 CSS 变量提供。

```tsx
import { SidebarIconButton, TopbarIconButton, TabbarIcon, RightSidebarIcon } from '@mpms/ui';

// 侧边栏专用图标按钮
<SidebarIconButton
  icon={<Icon name="navigation-menu" />}
  tooltip="菜单"
  active={isActive}
  collapsed={sidebarCollapsed}
/>

// 顶栏专用图标按钮
<TopbarIconButton
  icon={<Icon name="status-notice" />}
  tooltip="通知"
  badge={3}
/>

// 标签栏专用图标
<TabbarIcon
  icon={<Icon name="actions-close" />}
  tooltip="关闭"
  onClick={handleClose}
/>

// 右侧边栏专用图标
<RightSidebarIcon
  icon={<Icon name="tools-palette" />}
  tooltip="工具箱"
  active={isExpanded}
/>
```

### 2. 分子组件（Molecules）

分子组件由原子组件组合而成，形成更复杂的功能单元。

```tsx
import { Topbar, UserDropdown, NotificationIcon, SidebarMenu } from '@mpms/ui';

// 顶栏组件组合多个原子组件
<Topbar
  left={<IconButton icon={<Icon name="navigation-menu" />} />}
  center={<GlobalSearch />}
  right={
    <>
      <NotificationIcon badge={3} />
      <ThemeSwitcher />
      <UserDropdown user={currentUser} />
    </>
  }
/>

// 侧边栏菜单
<SidebarMenu
  items={menuItems}
  activeKey={activeMenuKey}
  collapsed={isCollapsed}
  onSelect={handleMenuSelect}
/>
```

### 3. 布局组件（Layouts）

布局组件提供页面的整体结构框架，使用插槽模式组织内容。

```tsx
import { AppLayout, Topbar, Sidebar, TabBar, BreadcrumbBar } from '@mpms/ui';

<AppLayout
  sidebar={<Sidebar items={menuItems} collapsed={collapsed} />}
  topbar={<Topbar left={...} center={...} right={...} />}
  tabbar={<TabBar tabs={tabs} activeTab={activeTab} />}
  breadcrumb={<BreadcrumbBar items={breadcrumbs} />}
  rightSidebar={<RightSidebar collapsed={sidebarCollapsed} />}>
  <Outlet />
</AppLayout>
```

## Design Token 使用

Design Token 系统提供完整的主题定制能力。

### 方法一：使用 ThemeProvider（推荐）

```tsx
import { ThemeProvider } from '@mpms/ui';

// 使用默认暗色主题
<ThemeProvider>
  <App />
</ThemeProvider>

// 指定初始主题模式
<ThemeProvider initialMode="dark">
  <App />
</ThemeProvider>
```

### 方法二：动态切换主题

```tsx
import { useTheme } from '@mpms/ui';

function ThemeSwitcher() {
  const { mode, setMode } = useTheme();

  return (
    <select value={mode} onChange={(e) => setMode(e.target.value as ThemeMode)}>
      <option value="light">浅色主题</option>
      <option value="dark">暗色主题</option>
    </select>
  );
}
```

### 方法三：应用自定义令牌

```tsx
import { useTheme } from '@mpms/ui';

function CustomTheme() {
  const { applyTokens } = useTheme();

  useEffect(() => {
    applyTokens({
      colors: {
        primary: '#ff6b00',
        primaryHover: '#ff8c00',
        layoutBg: '#1a1a2e',
      },
    });
  }, []);

  return null;
}
```

### 方法四：获取 CSS 变量

```tsx
import { getThemeCSSString, getThemeCSSVariables } from '@mpms/ui';

// 获取完整 CSS 变量字符串
const cssString = getThemeCSSString('dark');

// 获取 CSS 变量对象（用于内联样式）
const cssProps = getThemeCSSVariables('dark');
```

### 预定义主题

```tsx
import { themes } from '@mpms/ui';

// 使用预定义暗色主题
const darkTheme = themes.dark;
```

## 可用的 Design Token

### 颜色令牌

```typescript
interface ColorTokens {
  // 主色
  primary: string;
  primaryHover: string;
  primaryActive: string;

  // 布局背景色
  layoutBg: string;
  sidebarBg: string;
  headerBg: string;
  tabbarBg: string;
  contentBg: string;

  // 文字颜色
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  // 边框颜色
  borderColor: string;

  // 状态颜色
  success: string;
  warning: string;
  error: string;
  info: string;

  // 交互状态
  hoverBg: string;
  activeBg: string;

  // 危险色
  danger: string;
  dangerHover: string;
}
```

### 间距令牌

```typescript
interface SpacingTokens {
  // 基础间距
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;

  // 组件尺寸
  sidebarWidth: string;
  sidebarCollapsedWidth: string;
  headerHeight: string;
  tabbarHeight: string;
}
```

### 排版令牌

```typescript
interface TypographyTokens {
  // 字体
  fontFamily: string;
  fontFamilyMono: string;

  // 字号
  fontSizeXs: string;
  fontSizeSm: string;
  fontSizeMd: string;
  fontSizeLg: string;

  // 字重
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightSemibold: number;
  fontWeightBold: number;
}
```

## 组件 API 参考

### 原子组件 API

#### Icon

```typescript
interface IconProps {
  name: string;          // 图标名称（格式：category-iconName）
  size?: number;        // 图标尺寸（默认：20）
  color?: string;       // 图标颜色（默认：currentColor）
  className?: string;   // 额外 CSS 类名
  onClick?: () => void; // 点击事件
}
```

#### IconButton

```typescript
interface IconButtonProps {
  icon: React.ReactNode;      // 图标元素
  tooltip?: string;            // 提示文字
  badge?: number | string;    // 徽章数量
  active?: boolean;           // 是否激活
  size?: 'sm' | 'md';        // 尺寸（默认：md）
  onClick?: () => void;       // 点击事件
  className?: string;        // 额外 CSS 类名
}
```

### 布局特定原子组件 API

#### SidebarIconButton

```typescript
interface SidebarIconButtonProps {
  icon: React.ReactNode;      // 图标元素
  tooltip?: string;            // 提示文字
  active?: boolean;           // 是否激活
  collapsed?: boolean;        // 侧边栏是否折叠
  onClick?: () => void;       // 点击事件
  className?: string;        // 额外 CSS 类名
}
```

#### TopbarIconButton

```typescript
interface TopbarIconButtonProps {
  icon: React.ReactNode;      // 图标元素
  tooltip?: string;            // 提示文字
  badge?: number | string;    // 徽章数量
  active?: boolean;           // 是否激活
  onClick?: () => void;       // 点击事件
  className?: string;        // 额外 CSS 类名
}
```

### 组合式函数 API

#### useToggle

```typescript
function useToggle(initial = false): {
  value: boolean;
  toggle: () => void;
  setTrue: () => void;
  setFalse: () => void;
  setValue: (value: boolean) => void;
}
```

#### useTabs

```typescript
function useTabs(initialTabs?: TabItem[], initialActive?: string): {
  tabs: TabItem[];
  activeTab: string;
  setActiveTab: (key: string) => void;
  addTab: (tab: TabItem) => void;
  removeTab: (key: string) => void;
  closeLeft: (key: string) => void;
  closeRight: (key: string) => void;
  closeOther: (key: string) => void;
  closeAll: () => void;
  togglePin: (key: string) => void;
}
```

#### useFullscreen

```typescript
function useFullscreen(elementRef: RefObject<Element>): {
  isFullscreen: boolean;
  toggle: () => void;
  enter: () => void;
  exit: () => void;
}
```

#### useBreakpoint

```typescript
function useBreakpoint(): {
  xs: boolean;
  sm: boolean;
  md: boolean;
  lg: boolean;
  xl: boolean;
  xxl: boolean;
}
```

## 最佳实践

### 1. 组件选择指南

- 需要跨所有场景一致的按钮样式：使用 `IconButton`
- 需要侧边栏专用样式：使用 `SidebarIconButton`
- 需要顶栏专用样式：使用 `TopbarIconButton`
- 需要标签栏专用样式：使用 `TabbarIcon`
- 需要右侧边栏专用样式：使用 `RightSidebarIcon`

### 2. 主题定制建议

- 全局主题切换：使用 `ThemeProvider`
- 组件级主题覆盖：通过 `tokens` 属性或 CSS 变量
- 深色/浅色模式：使用 `mode` 属性配合 `setMode`

### 3. 性能优化

- 大规模主题切换：使用 CSS 变量而非 JavaScript 对象
- 避免不必要的重新渲染：使用 `useMemo` 缓存令牌
- 减少 CSS 变量数量：只覆盖需要更改的令牌

## 迁移指南

### 从 v1.x 迁移

如果你是从旧版本迁移，请注意以下变化：

1. **组件路径变更**
   ```tsx
   // 旧版本
   import { Icon, IconButton } from '@mpms/ui/components';

   // 新版本
   import { Icon, IconButton } from '@mpms/ui';
   ```

2. **ThemeProvider 变更**
   ```tsx
   // 旧版本
   import { Theme } from '@mpms/ui';

   // 新版本
   import { ThemeProvider } from '@mpms/ui';
   ```

3. **Design Token API 变更**
   ```tsx
   // 旧版本
   const tokens = { primaryColor: '#f00' };

   // 新版本
   const tokens = { colors: { primary: '#f00' } };
   ```

## 示例项目

### 完整应用示例

```tsx
import React from 'react';
import {
  AppLayout,
  Topbar,
  Sidebar,
  TabBar,
  BreadcrumbBar,
  RightSidebar,
  Icon,
  IconButton,
  SidebarIconButton,
  TabbarIcon,
  ThemeProvider,
  useTabs,
} from '@mpms/ui';

function App() {
  const { tabs, activeTab, addTab, removeTab } = useTabs();

  return (
    <ThemeProvider initialMode="dark">
      <AppLayout
        sidebar={
          <Sidebar
            items={menuItems}
            collapsed={sidebarCollapsed}
            onSelect={handleMenuSelect}
          />
        }
        topbar={
          <Topbar
            left={
              <IconButton
                icon={<Icon name="navigation-menu" />}
                onClick={() => setCollapsed(!sidebarCollapsed)}
              />
            }
            center={<GlobalSearch />}
            right={
              <>
                <NotificationIcon badge={3} />
                <UserDropdown user={currentUser} />
              </>
            }
          />
        }
        tabbar={
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onTabClose={removeTab}
          />
        }
        breadcrumb={<BreadcrumbBar items={breadcrumbs} />}
        rightSidebar={
          <RightSidebar collapsed={rightSidebarCollapsed}>
            <RightSidebarIcon
              icon={<Icon name="tools-palette" />}
              tooltip="工具"
            />
          </RightSidebar>
        }>
        <Outlet />
      </AppLayout>
    </ThemeProvider>
  );
}
```
