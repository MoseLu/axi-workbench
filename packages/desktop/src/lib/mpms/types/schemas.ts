/**
 * Zod Schema Validation
 * 
 * 为 @mpms/ui 提供 Zod 模式验证
 * 使用 Zod 定义运行时验证，同时保持与 TypeScript 类型的同步
 * 
 * 使用方式:
 * ```typescript
 * import { schemas } from '@mpms/ui';
 * 
 * // 验证数据
 * const result = schemas.MenuItem.safeParse(data);
 * if (!result.success) {
 *   console.log(result.error);
 * }
 * 
 * // 从 Schema 推断类型
 * type MenuItem = z.infer<typeof schemas.MenuItem>;
 * ```
 */
import { z } from 'zod';

// ========== 辅助函数 ==========

/**
 * 创建带自引用的 Schema
 */
function lazyRecursive<T extends z.ZodTypeAny>(schemaFactory: () => T): T {
  return z.lazy(() => schemaFactory()) as unknown as T;
}

// ========== 基础类型 Schema ==========

/**
 * 菜单项 Schema
 */
export const MenuItemSchema: z.ZodType<{
  key: string;
  label: string;
  icon?: unknown;
  children?: Array<{ key: string; label: string; icon?: unknown; children?: any[]; path?: string; disabled?: boolean; hidden?: boolean }>;
  path?: string;
  disabled?: boolean;
  hidden?: boolean;
}> = z.object({
  key: z.string(),
  label: z.string(),
  icon: z.unknown().optional(),
  children: z.array(z.lazy(() => MenuItemSchema)).optional(),
  path: z.string().optional(),
  disabled: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

/**
 * Tab 项 Schema
 */
export const TabItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  path: z.string(),
  closable: z.boolean().optional(),
  icon: z.unknown().optional(),
});

/**
 * 面包屑项 Schema
 */
export const BreadcrumbItemSchema = z.object({
  label: z.string(),
  icon: z.unknown().optional(),
  path: z.string().optional(),
});

/**
 * 图标按钮配置 Schema
 */
export const IconButtonConfigSchema = z.object({
  icon: z.union([z.string(), z.unknown()]),
  tooltip: z.string().optional(),
  badge: z.union([z.number(), z.string()]).optional(),
  onClick: z.function().optional(),
});

/**
 * 用户信息 Schema
 */
export const UserInfoSchema = z.object({
  name: z.string(),
  avatar: z.string().optional(),
  role: z.string().optional(),
});

/**
 * 用户菜单项 Schema
 */
export const UserMenuItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  icon: z.unknown().optional(),
  danger: z.boolean().optional(),
  divider: z.boolean().optional(),
  onClick: z.function().optional(),
});

/**
 * 通知/消息项 Schema
 */
export const NoticeItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  time: z.string().optional(),
  read: z.boolean().optional(),
  avatar: z.string().optional(),
  type: z.enum(['info', 'warning', 'error', 'success']).optional(),
});

// ========== 布局类型 Schema ==========

/**
 * 布局插槽名称 Schema
 */
export const LayoutSlotSchema = z.enum(['topbar', 'sidebar', 'rightSidebar', 'tabbar', 'breadcrumb', 'content']);

/**
 * 菜单类型 Schema
 */
export const MenuTypeSchema = z.enum(['left', 'left-dual', 'top']);

/**
 * 主题模式 Schema
 */
export const ThemeModeSchema = z.enum(['light', 'dark', 'auto']);

/**
 * 语言环境 Schema
 */
export const LocaleSchema = z.enum(['zh-CN', 'en-US']);

// ========== Ant Design 兼容 Schema ==========

/**
 * 尺寸 Schema
 */
export const SizeSchema = z.enum(['small', 'middle', 'large', 'xs', 'sm', 'md', 'lg', 'xl']);

/**
 * 形状 Schema
 */
export const ShapeSchema = z.enum(['default', 'circle', 'round']);

/**
 * 变体 Schema
 */
export const VariantSchema = z.enum(['primary', 'secondary', 'success', 'warning', 'danger', 'link', 'default']);

/**
 * 加载状态 Schema
 */
export const LoadingSchema = z.union([z.boolean(), z.object({ delay: z.number().optional() })]);

/**
 * Button Props Schema
 */
export const ButtonPropsSchema = z.object({
  type: z.enum(['primary', 'default', 'dashed', 'link', 'text']).optional(),
  size: SizeSchema.optional(),
  icon: z.unknown().optional(),
  loading: LoadingSchema.optional(),
  shape: ShapeSchema.optional(),
  danger: z.boolean().optional(),
  block: z.boolean().optional(),
  disabled: z.boolean().optional(),
  onClick: z.function().optional(),
  children: z.unknown().optional(),
  className: z.string().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Input Props Schema
 */
export const InputPropsSchema = z.object({
  value: z.string().optional(),
  defaultValue: z.string().optional(),
  prefix: z.unknown().optional(),
  suffix: z.unknown().optional(),
  size: SizeSchema.optional(),
  addonBefore: z.unknown().optional(),
  addonAfter: z.unknown().optional(),
  status: z.enum(['error', 'warning']).optional(),
  disabled: z.boolean().optional(),
  placeholder: z.string().optional(),
  onChange: z.function().optional(),
  className: z.string().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Select Option Schema
 */
export const SelectOptionSchema = z.object({
  label: z.string(),
  value: z.unknown(),
  disabled: z.boolean().optional(),
});

/**
 * Select Props Schema
 */
export const SelectPropsSchema = z.object({
  value: z.unknown().optional(),
  defaultValue: z.unknown().optional(),
  options: SelectOptionSchema.array().optional(),
  placeholder: z.string().optional(),
  size: SizeSchema.optional(),
  mode: z.enum(['multiple', 'tags']).optional(),
  allowClear: z.boolean().optional(),
  showSearch: z.boolean().optional(),
  disabled: z.boolean().optional(),
  onChange: z.function().optional(),
  className: z.string().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Modal Props Schema
 */
export const ModalPropsSchema = z.object({
  title: z.unknown().optional(),
  content: z.unknown().optional(),
  footer: z.unknown().optional(),
  open: z.boolean().optional(),
  okText: z.unknown().optional(),
  cancelText: z.unknown().optional(),
  confirmLoading: z.boolean().optional(),
  centered: z.boolean().optional(),
  width: z.union([z.number(), z.string()]).optional(),
  okButtonProps: z.record(z.string(), z.unknown()).optional(),
  cancelButtonProps: z.record(z.string(), z.unknown()).optional(),
  onOk: z.function().optional(),
  onCancel: z.function().optional(),
  onOpenChange: z.function().optional(),
});

/**
 * Dropdown Trigger Schema
 */
export const DropdownTriggerSchema = z.enum(['click', 'hover', 'contextMenu']);

/**
 * Dropdown Placement Schema
 */
export const DropdownPlacementSchema = z.enum(['bottomLeft', 'bottomCenter', 'bottomRight', 'topLeft', 'topCenter', 'topRight']);

/**
 * Dropdown Props Schema
 */
export const DropdownPropsSchema = z.object({
  overlay: z.unknown().optional(),
  trigger: DropdownTriggerSchema.array().optional(),
  placement: DropdownPlacementSchema.optional(),
  disabled: z.boolean().optional(),
  destroyPopupOnHide: z.boolean().optional(),
  onOpenChange: z.function().optional(),
});

/**
 * Menu Item Props Schema
 */
export const MenuItemPropsSchema: z.ZodType<{
  key?: string;
  label?: unknown;
  icon?: unknown;
  disabled?: boolean;
  divider?: boolean;
  children?: Array<{ key?: string; label?: unknown; icon?: unknown; disabled?: boolean; divider?: boolean; children?: any[] }>;
}> = z.object({
  key: z.string().optional(),
  label: z.unknown().optional(),
  icon: z.unknown().optional(),
  disabled: z.boolean().optional(),
  divider: z.boolean().optional(),
  children: z.array(z.lazy(() => MenuItemPropsSchema)).optional(),
});

/**
 * Menu Props Schema
 */
export const MenuPropsSchema = z.object({
  items: MenuItemPropsSchema.array().optional(),
  selectedKeys: z.string().array().optional(),
  openKeys: z.string().array().optional(),
  mode: z.enum(['vertical', 'horizontal', 'inline']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  inlineCollapsed: z.boolean().optional(),
  onClick: z.function().optional(),
  onSelect: z.function().optional(),
});

/**
 * Tab Item Props Schema
 */
export const TabItemPropsSchema = z.object({
  key: z.string().optional(),
  label: z.unknown().optional(),
  disabled: z.boolean().optional(),
  closable: z.boolean().optional(),
  icon: z.unknown().optional(),
});

/**
 * Tabs Props Schema
 */
export const TabsPropsSchema = z.object({
  items: TabItemPropsSchema.array().optional(),
  activeKey: z.string().optional(),
  defaultActiveKey: z.string().optional(),
  size: SizeSchema.optional(),
  type: z.enum(['line', 'card', 'editable-card']).optional(),
  tabPosition: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  onChange: z.function().optional(),
  onEdit: z.function().optional(),
});

/**
 * Card Props Schema
 */
export const CardPropsSchema = z.object({
  title: z.unknown().optional(),
  extra: z.unknown().optional(),
  children: z.unknown().optional(),
  size: SizeSchema.optional(),
  bordered: z.boolean().optional(),
  loading: LoadingSchema.optional(),
  cover: z.unknown().optional(),
  actions: z.unknown().array().optional(),
});

/**
 * Table Column Props Schema
 */
export const TableColumnPropsSchema = <T extends z.ZodTypeAny>(itemSchema: T) => z.object({
  dataIndex: z.string().optional(),
  title: z.unknown().optional(),
  key: z.string().optional(),
  width: z.union([z.number(), z.string()]).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  fixed: z.enum(['left', 'right']).optional(),
  render: z.function().optional(),
  sorter: z.union([z.boolean(), z.function()]).optional(),
  filters: z.object({ text: z.string(), value: z.unknown() }).array().optional(),
});

/**
 * Table Pagination Props Schema
 */
export const TablePaginationPropsSchema = z.object({
  current: z.number().optional(),
  pageSize: z.number().optional(),
  total: z.number().optional(),
  showSizeChanger: z.boolean().optional(),
  pageSizeOptions: z.number().array().optional(),
  onChange: z.function().optional(),
});

/**
 * Table Props Schema
 */
export const TablePropsSchema = <T extends z.ZodTypeAny = z.ZodNever>(itemSchema: T) => z.object({
  columns: TableColumnPropsSchema(itemSchema).array().optional(),
  dataSource: itemSchema.array().optional(),
  rowKey: z.union([z.string(), z.function()]).optional(),
  loading: LoadingSchema.optional(),
  size: SizeSchema.optional(),
  pagination: z.union([z.boolean(), TablePaginationPropsSchema]).optional(),
  onChange: z.function().optional(),
});

/**
 * Message Props Schema
 */
export const MessagePropsSchema = z.object({
  content: z.unknown().optional(),
  duration: z.number().optional(),
  onClose: z.function().optional(),
});

/**
 * Notification Props Schema
 */
export const NotificationPropsSchema = z.object({
  title: z.unknown().optional(),
  message: z.unknown().optional(),
  description: z.unknown().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
  className: z.string().optional(),
  placement: z.enum(['topLeft', 'topRight', 'bottomLeft', 'bottomRight']).optional(),
  duration: z.number().optional(),
  onClose: z.function().optional(),
});

/**
 * Drawer Props Schema
 */
export const DrawerPropsSchema = z.object({
  title: z.unknown().optional(),
  open: z.boolean().optional(),
  width: z.union([z.number(), z.string()]).optional(),
  height: z.union([z.number(), z.string()]).optional(),
  placement: z.enum(['left', 'right', 'top', 'bottom']).optional(),
  footer: z.unknown().optional(),
  onClose: z.function().optional(),
});

/**
 * Tooltip Props Schema
 */
export const TooltipPropsSchema = z.object({
  title: z.unknown().optional(),
  children: z.unknown().optional(),
  placement: z.enum(['top', 'left', 'right', 'bottom', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight']).optional(),
  color: z.string().optional(),
});

/**
 * Popconfirm Props Schema
 */
export const PopconfirmPropsSchema = z.object({
  title: z.unknown().optional(),
  okText: z.unknown().optional(),
  cancelText: z.unknown().optional(),
  onConfirm: z.function().optional(),
  onCancel: z.function().optional(),
});

/**
 * Tag Props Schema
 */
export const TagPropsSchema = z.object({
  children: z.unknown().optional(),
  color: z.string().optional(),
  closable: z.boolean().optional(),
  visible: z.boolean().optional(),
  onClose: z.function().optional(),
});

/**
 * Badge Status Schema
 */
export const BadgeStatusSchema = z.enum(['success', 'processing', 'default', 'error', 'warning']);

/**
 * Badge Props Schema
 */
export const BadgePropsSchema = z.object({
  count: z.unknown().optional(),
  showZero: z.boolean().optional(),
  overflowCount: z.number().optional(),
  status: BadgeStatusSchema.optional(),
  color: z.string().optional(),
  text: z.unknown().optional(),
  offset: z.tuple([z.union([z.number(), z.string()]), z.union([z.number(), z.string()])]).optional(),
});

/**
 * Avatar Props Schema
 */
export const AvatarPropsSchema = z.object({
  src: z.string().optional(),
  icon: z.unknown().optional(),
  shape: ShapeSchema.optional(),
  size: z.union([SizeSchema, z.number()]).optional(),
  loading: z.boolean().optional(),
  onError: z.function().optional(),
});

/**
 * Form Item Props Schema
 */
export const FormItemPropsSchema = z.object({
  label: z.unknown().optional(),
  labelCol: z.record(z.string(), z.unknown()).optional(),
  wrapperCol: z.record(z.string(), z.unknown()).optional(),
  help: z.unknown().optional(),
  extra: z.unknown().optional(),
  validateStatus: z.enum(['success', 'warning', 'error', 'validating']).optional(),
  required: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

// ========== Schema 集合 ==========

/**
 * 所有 Schema 的集合
 */
export const schemas = {
  // 基础类型
  MenuItem: MenuItemSchema,
  TabItem: TabItemSchema,
  BreadcrumbItem: BreadcrumbItemSchema,
  IconButtonConfig: IconButtonConfigSchema,
  UserInfo: UserInfoSchema,
  UserMenuItem: UserMenuItemSchema,
  NoticeItem: NoticeItemSchema,

  // 布局
  LayoutSlot: LayoutSlotSchema,
  MenuType: MenuTypeSchema,
  ThemeMode: ThemeModeSchema,
  Locale: LocaleSchema,

  // Ant Design 兼容
  Size: SizeSchema,
  Shape: ShapeSchema,
  Variant: VariantSchema,
  Loading: LoadingSchema,
  ButtonProps: ButtonPropsSchema,
  InputProps: InputPropsSchema,
  SelectOption: SelectOptionSchema,
  SelectProps: SelectPropsSchema,
  ModalProps: ModalPropsSchema,
  DropdownTrigger: DropdownTriggerSchema,
  DropdownPlacement: DropdownPlacementSchema,
  DropdownProps: DropdownPropsSchema,
  MenuItemProps: MenuItemPropsSchema,
  MenuProps: MenuPropsSchema,
  TabItemProps: TabItemPropsSchema,
  TabsProps: TabsPropsSchema,
  CardProps: CardPropsSchema,
  TableColumnProps: TableColumnPropsSchema,
  TablePaginationProps: TablePaginationPropsSchema,
  TableProps: TablePropsSchema,
  MessageProps: MessagePropsSchema,
  NotificationProps: NotificationPropsSchema,
  DrawerProps: DrawerPropsSchema,
  TooltipProps: TooltipPropsSchema,
  PopconfirmProps: PopconfirmPropsSchema,
  TagProps: TagPropsSchema,
  BadgeStatus: BadgeStatusSchema,
  BadgeProps: BadgePropsSchema,
  AvatarProps: AvatarPropsSchema,
  FormItemProps: FormItemPropsSchema,
} as const;

// ========== 便捷类型推断 ==========

/** MenuItem 类型推断 */
export type ZodMenuItem = z.infer<typeof MenuItemSchema>;

/** TabItem 类型推断 */
export type ZodTabItem = z.infer<typeof TabItemSchema>;

/** BreadcrumbItem 类型推断 */
export type ZodBreadcrumbItem = z.infer<typeof BreadcrumbItemSchema>;

/** UserInfo 类型推断 */
export type ZodUserInfo = z.infer<typeof UserInfoSchema>;

/** NoticeItem 类型推断 */
export type ZodNoticeItem = z.infer<typeof NoticeItemSchema>;

/** ThemeMode 类型推断 */
export type ZodThemeMode = z.infer<typeof ThemeModeSchema>;

/** Locale 类型推断 */
export type ZodLocale = z.infer<typeof LocaleSchema>;

/** ButtonProps 类型推断 */
export type ZodButtonProps = z.infer<typeof ButtonPropsSchema>;

/** InputProps 类型推断 */
export type ZodInputProps = z.infer<typeof InputPropsSchema>;

/** SelectProps 类型推断 */
export type ZodSelectProps<T = unknown> = z.infer<typeof SelectPropsSchema>;

/** ModalProps 类型推断 */
export type ZodModalProps = z.infer<typeof ModalPropsSchema>;

/** DropdownProps 类型推断 */
export type ZodDropdownProps = z.infer<typeof DropdownPropsSchema>;

/** MenuProps 类型推断 */
export type ZodMenuProps = z.infer<typeof MenuPropsSchema>;

/** TabsProps 类型推断 */
export type ZodTabsProps = z.infer<typeof TabsPropsSchema>;

/** TableProps 类型推断 */
export type ZodTableProps<T = unknown> = z.infer<typeof TablePropsSchema>;

/** CardProps 类型推断 */
export type ZodCardProps = z.infer<typeof CardPropsSchema>;

/** FormItemProps 类型推断 */
export type ZodFormItemProps = z.infer<typeof FormItemPropsSchema>;

export default schemas;
