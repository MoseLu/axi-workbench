/**
 * Dropdown Primitive - 基于 Radix UI 的下拉菜单
 * 
 * 保留 Radix 的无障碍特性，同时添加样式集成
 */
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';
import React from 'react';

export const DropdownMenu = RadixDropdownMenu.Root;
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;
export const DropdownMenuGroup = RadixDropdownMenu.Group;
export const DropdownMenuPortal = RadixDropdownMenu.Portal;
export const DropdownMenuSub = RadixDropdownMenu.Sub;
export const DropdownMenuRadioGroup = RadixDropdownMenu.RadioGroup;

/** 下拉菜单内容 */
export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  RadixDropdownMenu.DropdownMenuContentProps & { className?: string }
>(({ className = '', children, ...props }, ref) => (
  <RadixDropdownMenu.Portal>
    <RadixDropdownMenu.Content
      ref={ref}
      className={`dropdown-menu-content ${className}`}
      {...props}
    >
      {children}
    </RadixDropdownMenu.Content>
  </RadixDropdownMenu.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

/** 下拉菜单项 */
export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  RadixDropdownMenu.DropdownMenuItemProps & { className?: string }
>(({ className = '', ...props }, ref) => (
  <RadixDropdownMenu.Item
    ref={ref}
    className={`dropdown-menu-item ${className}`}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

/** 带分隔符的下拉菜单项 */
export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  RadixDropdownMenu.DropdownMenuSeparatorProps & { className?: string }
>(({ className = '', ...props }, ref) => (
  <RadixDropdownMenu.Separator
    ref={ref}
    className={`dropdown-menu-separator ${className}`}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

/** 带箭头的下拉菜单 (用于 Popover) */
export const DropdownMenuArrow = React.forwardRef<
  SVGSVGElement,
  RadixDropdownMenu.DropdownMenuArrowProps & { className?: string }
>(({ className = '', ...props }, ref) => (
  <RadixDropdownMenu.Arrow
    ref={ref}
    className={`dropdown-menu-arrow ${className}`}
    {...props}
  />
));
DropdownMenuArrow.displayName = 'DropdownMenuArrow';

/** 子菜单触发器 */
export const DropdownMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  RadixDropdownMenu.DropdownMenuSubTriggerProps & { className?: string }
>(({ className = '', ...props }, ref) => (
  <RadixDropdownMenu.SubTrigger
    ref={ref}
    className={`dropdown-menu-subtrigger ${className}`}
    {...props}
  />
));
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

/** 子菜单内容 */
export const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  RadixDropdownMenu.DropdownMenuSubContentProps & { className?: string }
>(({ className = '', ...props }, ref) => (
  <RadixDropdownMenu.Portal>
    <RadixDropdownMenu.SubContent
      ref={ref}
      className={`dropdown-menu-subcontent ${className}`}
      {...props}
    />
  </RadixDropdownMenu.Portal>
));
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

export default {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuArrow,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
};
