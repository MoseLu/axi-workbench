/**
 * Ant Design Type Compatibility
 * 
 * 为 @mpms/ui 添加与 Ant Design 组件类型兼容的定义
 * 提供与 Ant Design API 兼容的类型，使得从 Ant Design 迁移更顺畅
 */
import type { ComponentProps, CSSProperties, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

// Re-export all compatibility types
export * from './index';

/**
 * 扩展 Ant Design 的组件 Props
 */
export interface MpmsComponentProps {
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 子元素 */
  children?: ReactNode;
}

/**
 * 变体类型 (与 Ant Design 一致)
 */
export type Variant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'link' | 'default';

/**
 * 尺寸类型
 */
export type Size = 'small' | 'middle' | 'large' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * 形状类型
 */
export type Shape = 'default' | 'circle' | 'round';

/**
 * 加载状态
 */
export type Loading = boolean | { delay?: number };

/**
 * 事件处理器类型
 */
export type MpmsEventHandler<T = HTMLDivElement> = (event: React.MouseEvent<T>) => void;

/**
 * 焦点事件处理器
 */
export type MpmsFocusEventHandler<T = HTMLDivElement> = (event: React.FocusEvent<T>) => void;

/**
 * 禁用状态
 */
export type Disabled = boolean;

/**
 * 只读状态
 */
export type Readonly = boolean;

/**
 * 与 Ant Design 兼容的 Button Props
 */
export interface ButtonProps {
  /** 按钮类型 */
  type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  /** 尺寸 */
  size?: Size;
  /** 图标 */
  icon?: ReactNode;
  /** 加载状态 */
  loading?: Loading;
  /** 形状 */
  shape?: Shape;
  /** 危险按钮 */
  danger?: boolean;
  /** 块级按钮 */
  block?: boolean;
  /** 禁用 */
  disabled?: boolean;
  /** 点击处理器 */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** 子元素 */
  children?: ReactNode;
  /** 类名 */
  className?: string;
  /** 样式 */
  style?: CSSProperties;
}

/**
 * 与 Ant Design 兼容的 Input Props
 */
export interface InputProps {
  /** 值 */
  value?: string;
  /** 默认值 */
  defaultValue?: string;
  /** 前缀图标 */
  prefix?: ReactNode;
  /** 后缀图标 */
  suffix?: ReactNode;
  /** 尺寸 */
  size?: Size;
  /** 前置标签 */
  addonBefore?: ReactNode;
  /** 后置标签 */
  addonAfter?: ReactNode;
  /** 状态 */
  status?: 'error' | 'warning';
  /** 禁用 */
  disabled?: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 变化回调 */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** 类名 */
  className?: string;
  /** 样式 */
  style?: CSSProperties;
}

/**
 * 与 Ant Design 兼容的 Select Props
 */
export interface SelectProps<T = any> {
  /** 值 */
  value?: T | T[];
  /** 默认值 */
  defaultValue?: T | T[];
  /** 选项 */
  options?: Array<{ label: string; value: T; disabled?: boolean; }>;
  /** 占位符 */
  placeholder?: string;
  /** 尺寸 */
  size?: Size;
  /** 多选 */
  mode?: 'multiple' | 'tags';
  /** 是否可清除 */
  allowClear?: boolean;
  /** 搜索过滤 */
  showSearch?: boolean;
  /** 禁用 */
  disabled?: boolean;
  /** 值变化回调 */
  onChange?: (value: T | T[]) => void;
  /** 类名 */
  className?: string;
  /** 样式 */
  style?: CSSProperties;
}

/**
 * 与 Ant Design 兼容的 Form Item Props
 */
export interface FormItemProps {
  /** 标签 */
  label?: ReactNode;
  /** 标签宽度 */
  labelCol?: object;
  /** 控件宽度 */
  wrapperCol?: object;
  /** 错误信息 */
  help?: ReactNode;
  /** 额外内容 */
  extra?: ReactNode;
  /** 验证状态 */
  validateStatus?: 'success' | 'warning' | 'error' | 'validating';
  /** 是否必填 */
  required?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 与 Ant Design 兼容的 Modal Props
 */
export interface ModalProps {
  /** 标题 */
  title?: ReactNode;
  /** 内容 */
  content?: ReactNode;
  /** 底部内容 */
  footer?: ReactNode;
  /** 是否显示 */
  open?: boolean;
  /** 确认按钮文本 */
  okText?: ReactNode;
  /** 取消按钮文本 */
  cancelText?: ReactNode;
  /** 确认按钮 loading */
  confirmLoading?: boolean;
  /** 底部按钮居中 */
  centered?: boolean;
  /** 宽度 */
  width?: number | string;
  /** 底部按钮配置 */
  okButtonProps?: object;
  cancelButtonProps?: object;
  /** 关闭回调 */
  onOk?: () => void;
  onCancel?: () => void;
  /** 可见性变化 */
  onOpenChange?: (open: boolean) => void;
}

/**
 * 与 Ant Design 兼容的 Dropdown Props
 */
export interface DropdownProps {
  /** 触发下拉的内容 */
  overlay?: ReactNode;
  /** 触发方式 */
  trigger?: ('click' | 'hover' | 'contextMenu')[];
  /** 放置位置 */
  placement?: 'bottomLeft' | 'bottomCenter' | 'bottomRight' | 'topLeft' | 'topCenter' | 'topRight';
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击隐藏 */
  destroyPopupOnHide?: boolean;
  /** 可见性变化 */
  onOpenChange?: (open: boolean) => void;
}

/**
 * 与 Ant Design 兼容的 Menu Props
 */
export interface MenuProps {
  /** 菜单项 */
  items?: MenuItemProps[];
  /** 选中键 */
  selectedKeys?: string[];
  /** 展开键 */
  openKeys?: string[];
  /** 模式 */
  mode?: 'vertical' | 'horizontal' | 'inline';
  /** 主题 */
  theme?: 'light' | 'dark';
  /** 是否内联折叠 */
  inlineCollapsed?: boolean;
  /** 点击回调 */
  onClick?: (info: { key: string }) => void;
  /** 选择回调 */
  onSelect?: (info: { selectedKeys: string[] }) => void;
}

/**
 * Menu item 类型
 */
export interface MenuItemProps {
  /** 键 */
  key?: string;
  /** 标签 */
  label?: ReactNode;
  /** 图标 */
  icon?: ReactNode;
  /** 禁用 */
  disabled?: boolean;
  /** 分隔线 */
  divider?: boolean;
  /** 子菜单 */
  children?: MenuItemProps[];
}

/**
 * 与 Ant Design 兼容的 Tabs Props
 */
export interface TabsProps {
  /** Tab 项 */
  items?: TabItemProps[];
  /** 激活键 */
  activeKey?: string;
  /** 默认激活键 */
  defaultActiveKey?: string;
  /** 尺寸 */
  size?: Size;
  /** 类型 */
  type?: 'line' | 'card' | 'editable-card';
  /** 位置 */
  tabPosition?: 'top' | 'bottom' | 'left' | 'right';
  /** 变化回调 */
  onChange?: (activeKey: string) => void;
  /** 编辑回调 */
  onEdit?: (action: 'add' | 'remove', key?: string) => void;
}

/**
 * Tab item 类型
 */
export interface TabItemProps {
  /** 键 */
  key?: string;
  /** 标签 */
  label?: ReactNode;
  /** 禁用 */
  disabled?: boolean;
  /** 关闭 */
  closable?: boolean;
  /** 图标 */
  icon?: ReactNode;
}

/**
 * 与 Ant Design 兼容的 Card Props
 */
export interface CardProps {
  /** 标题 */
  title?: ReactNode;
  /** 额外内容 */
  extra?: ReactNode;
  /** 内容 */
  children?: ReactNode;
  /** 尺寸 */
  size?: Size;
  /** 是否可填充 */
  bordered?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 封面 */
  cover?: ReactNode;
  /** 操作组 */
  actions?: ReactNode[];
}

/**
 * 与 Ant Design 兼容的 Table Props
 */
export interface TableProps<T = any> {
  /** 列定义 */
  columns?: TableColumnProps<T>[];
  /** 数据源 */
  dataSource?: T[];
  /** 行键 */
  rowKey?: string | ((record: T) => string);
  /** 加载状态 */
  loading?: Loading;
  /** 尺寸 */
  size?: Size;
  /** 是否分页 */
  pagination?: boolean | TablePaginationProps;
  /** 变化回调 */
  onChange?: (pagination: any, filters: any, sorter: any) => void;
}

/**
 * Table column 类型
 */
export interface TableColumnProps<T = any> {
  /** 数据键 */
  dataIndex?: string;
  /** 标题 */
  title?: ReactNode;
  /** 键 */
  key?: string;
  /** 宽度 */
  width?: number | string;
  /** 对齐 */
  align?: 'left' | 'center' | 'right';
  /** 固定 */
  fixed?: 'left' | 'right';
  /** 渲染 */
  render?: (value: any, record: T, index: number) => ReactNode;
  /** 可排序 */
  sorter?: boolean | ((a: T, b: T) => number);
  /** 筛选 */
  filters?: Array<{ text: string; value: any }>;
}

/**
 * Table 分页配置
 */
export interface TablePaginationProps {
  /** 当前页 */
  current?: number;
  /** 页大小 */
  pageSize?: number;
  /** 总数 */
  total?: number;
  /** 显示尺寸选择器 */
  showSizeChanger?: boolean;
  /** 页大小选项 */
  pageSizeOptions?: number[];
  /** 变化回调 */
  onChange?: (page: number, pageSize: number) => void;
}

/**
 * 与 Ant Design 兼容的 Message Props
 */
export interface MessageProps {
  /** 内容 */
  content?: ReactNode;
  /** 持续时间 */
  duration?: number;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 与 Ant Design 兼容的 Notification Props
 */
export interface NotificationProps {
  /** 标题 */
  title?: ReactNode;
  /** 内容 */
  message?: ReactNode;
  /** 描述 */
  description?: ReactNode;
  /** 样式 */
  style?: CSSProperties;
  /** 类名 */
  className?: string;
  /** 放置位置 */
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  /** 持续时间 */
  duration?: number;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 与 Ant Design 兼容的 Drawer Props
 */
export interface DrawerProps {
  /** 标题 */
  title?: ReactNode;
  /** 是否显示 */
  open?: boolean;
  /** 宽度 */
  width?: number | string;
  /** 高度 */
  height?: number | string;
  /** 位置 */
  placement?: 'left' | 'right' | 'top' | 'bottom';
  /** 底部内容 */
  footer?: ReactNode;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 与 Ant Design 兼容的 Tooltip Props
 */
export interface TooltipProps {
  /** 标题内容 */
  title?: ReactNode;
  /** 子元素 */
  children?: ReactNode;
  /** 放置位置 */
  placement?: 'top' | 'left' | 'right' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  /** 颜色 */
  color?: string;
}

/**
 * 与 Ant Design 兼容的 Popconfirm Props
 */
export interface PopconfirmProps {
  /** 标题 */
  title?: ReactNode;
  /** 确认文本 */
  okText?: ReactNode;
  /** 取消文本 */
  cancelText?: ReactNode;
  /** 确认回调 */
  onConfirm?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/**
 * 与 Ant Design 兼容的 Tag Props
 */
export interface TagProps {
  /** 内容 */
  children?: ReactNode;
  /** 颜色 */
  color?: string;
  /** 可关闭 */
  closable?: boolean;
  /** 可见 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 与 Ant Design 兼容的 Badge Props
 */
export interface BadgeProps {
  /** 计数 */
  count?: ReactNode;
  /** 是否显示 */
  showZero?: boolean;
  /** 溢出数 */
  overflowCount?: number;
  /** 状态 */
  status?: 'success' | 'processing' | 'default' | 'error' | 'warning';
  /** 颜色 */
  color?: string;
  /** 文本 */
  text?: ReactNode;
  /** 偏移 */
  offset?: [number | string, number | string];
}

/**
 * 与 Ant Design 兼容的 Avatar Props
 */
export interface AvatarProps {
  /** 图片源 */
  src?: string;
  /** 图标 */
  icon?: ReactNode;
  /** 形状 */
  shape?: Shape;
  /** 尺寸 */
  size?: Size | number;
  /** 加载状态 */
  loading?: boolean;
  /** 错误回调 */
  onError?: () => boolean;
}
