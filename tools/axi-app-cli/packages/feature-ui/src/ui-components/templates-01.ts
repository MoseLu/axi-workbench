export function createComponentsIndex(): string {
  return `export { Button } from './Button';
export type { ButtonProps, ButtonShape, ButtonSize, ButtonVariant } from './Button';
export { Alert } from './Alert';
export type { AlertTone } from './Alert';
export { Accordion } from './Accordion';
export type { AccordionItem, AccordionProps } from './Accordion';
export { Badge } from './Badge';
export type { BadgeTone } from './Badge';
export { Breadcrumbs } from './Breadcrumbs';
export type { BreadcrumbItem, BreadcrumbsProps } from './Breadcrumbs';
export { ButtonLink } from './ButtonLink';
export { Avatar } from './Avatar';
export type { AvatarProps, AvatarSize } from './Avatar';
export { Card } from './Card';
export type { CardProps } from './Card';
export { Combobox } from './Combobox';
export type { ComboboxOption, ComboboxProps } from './Combobox';
export { CommandPalette } from './CommandPalette';
export type { CommandPaletteItem, CommandPaletteProps } from './CommandPalette';
export { ContextMenu } from './ContextMenu';
export type { ContextMenuItem, ContextMenuProps } from './ContextMenu';
export { DataTable } from './DataTable';
export type { DataTableColumn, DataTableProps } from './DataTable';
export { DatePicker } from './DatePicker';
export type { DatePickerProps } from './DatePicker';
export { DescriptionList } from './DescriptionList';
export type { DescriptionItem, DescriptionListProps } from './DescriptionList';
export { Drawer } from './Drawer';
export type { DrawerPlacement, DrawerProps } from './Drawer';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
export { EmptySearchState } from './EmptySearchState';
export type { EmptySearchStateProps } from './EmptySearchState';
export { FileTrigger } from './FileTrigger';
export type { FileTriggerProps } from './FileTrigger';
export { FormField } from './FormField';
export type { FormFieldProps } from './FormField';
export { InputField } from './InputField';
export type { InputFieldProps } from './InputField';
export { InlineActions } from './InlineActions';
export type { InlineActionItem, InlineActionsProps } from './InlineActions';
export { Modal } from './Modal';
export type { ModalProps } from './Modal';
export { NumberField } from './NumberField';
export type { NumberFieldProps } from './NumberField';
export { Pagination } from './Pagination';
export type { PaginationProps } from './Pagination';
export { PasswordField } from './PasswordField';
export type { PasswordFieldProps } from './PasswordField';
export { Progress } from './Progress';
export type { ProgressProps } from './Progress';
export { DropdownMenu } from './DropdownMenu';
export type { DropdownMenuItem, DropdownMenuProps } from './DropdownMenu';
export { SearchField } from './SearchField';
export type { SearchFieldProps } from './SearchField';
export { SectionCard } from './SectionCard';
export { SegmentedControl } from './SegmentedControl';
export type { SegmentedControlOption, SegmentedControlProps } from './SegmentedControl';
export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';
export { Spinner } from './Spinner';
export type { SpinnerProps, SpinnerSize } from './Spinner';
export { StatCard } from './StatCard';
export type { StatCardProps } from './StatCard';
export { Stepper } from './Stepper';
export type { StepperProps } from './Stepper';
export { StatusDot } from './StatusDot';
export type { StatusDotTone } from './StatusDot';
export { Switch } from './Switch';
export type { SwitchProps } from './Switch';
export { TagPicker } from './TagPicker';
export type { TagPickerOption, TagPickerProps } from './TagPicker';
export { Tabs } from './Tabs';
export type { TabItem, TabsProps } from './Tabs';
export { TextareaField } from './TextareaField';
export type { TextareaFieldProps } from './TextareaField';
export { Topbar } from './Topbar';
export type { TopbarItem, TopbarProps } from './Topbar';
export { Toast } from './Toast';
export type { ToastProps, ToastTone } from './Toast';
export { Tooltip } from './Tooltip';
export type { TooltipProps, TooltipSide } from './Tooltip';
export { ChipInput } from './ChipInput';
export type { ChipInputProps } from './ChipInput';
`;
}

export function createSectionCard(): string {
  return `import type { PropsWithChildren } from 'react';

interface SectionCardProps extends PropsWithChildren {
  description?: string;
  title: string;
}

export function SectionCard({ children, description, title }: SectionCardProps) {
  return (
    <section className="home-card">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  );
}
`;
}

export function createButtonLink(): string {
  return `interface ButtonLinkProps {
  href: string;
  label: string;
}

export function ButtonLink({ href, label }: ButtonLinkProps) {
  return (
    <a className="button-link" href={href}>
      {label}
    </a>
  );
}
`;
}

export function createAlert(): string {
  return `import type { PropsWithChildren } from 'react';

import './alert.css';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps extends PropsWithChildren {
  title?: string;
  tone?: AlertTone;
}

export function Alert({ children, title, tone = 'info' }: AlertProps) {
  return (
    <section className={\`axi-alert axi-alert--\${tone}\`} role="status">
      {title ? <strong className="axi-alert__title">{title}</strong> : null}
      {children ? <div className="axi-alert__body">{children}</div> : null}
    </section>
  );
}
`;
}

export function createAlertStyles(): string {
  return `.axi-alert {
  display: grid;
  gap: var(--space-2);
  border: var(--border-width-default) solid transparent;
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.axi-alert__title {
  font-size: var(--font-size-heading-sm);
  font-weight: var(--font-weight-semibold);
}

.axi-alert__body {
  color: inherit;
}

.axi-alert--info {
  border-color: color-mix(in srgb, var(--color-info-main) 30%, transparent);
  background: color-mix(in srgb, var(--color-info-main) 10%, var(--theme-bg-surface));
  color: var(--color-info-main);
}

.axi-alert--success {
  border-color: color-mix(in srgb, var(--color-success-main) 30%, transparent);
  background: color-mix(in srgb, var(--color-success-main) 10%, var(--theme-bg-surface));
  color: var(--color-success-main);
}

.axi-alert--warning {
  border-color: color-mix(in srgb, var(--color-warning-main) 30%, transparent);
  background: color-mix(in srgb, var(--color-warning-main) 10%, var(--theme-bg-surface));
  color: var(--color-warning-main);
}

.axi-alert--danger {
  border-color: color-mix(in srgb, var(--color-danger-main) 30%, transparent);
  background: color-mix(in srgb, var(--color-danger-main) 10%, var(--theme-bg-surface));
  color: var(--color-danger-main);
}
`;
}

export function createAlertTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert } from '@/shared/components/Alert';

describe('Alert', () => {
  it('renders title and content', () => {
    render(<Alert title="Heads up">Check the release checklist.</Alert>);

    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Check the release checklist.')).toBeInTheDocument();
  });
});
`;
}

export function createBadge(): string {
  return `import type { PropsWithChildren } from 'react';

import './badge.css';

export type BadgeTone = 'default' | 'info' | 'success' | 'warning' | 'danger';

interface BadgeProps extends PropsWithChildren {
  tone?: BadgeTone;
}

export function Badge({ children, tone = 'default' }: BadgeProps) {
  return <span className={\`axi-badge axi-badge--\${tone}\`}>{children}</span>;
}
`;
}

export function createBadgeStyles(): string {
  return `.axi-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.75rem;
  border-radius: 999px;
  padding: var(--space-1) var(--space-3);
  background: var(--color-surface-tag);
  color: var(--color-accent-primary);
  font-size: var(--font-size-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
}

.axi-badge--info {
  background: color-mix(in srgb, var(--color-info-main) 12%, var(--theme-bg-surface));
  color: var(--color-info-main);
}

.axi-badge--success {
  background: color-mix(in srgb, var(--color-success-main) 12%, var(--theme-bg-surface));
  color: var(--color-success-main);
}

.axi-badge--warning {
  background: color-mix(in srgb, var(--color-warning-main) 12%, var(--theme-bg-surface));
  color: var(--color-warning-main);
}

.axi-badge--danger {
  background: color-mix(in srgb, var(--color-danger-main) 12%, var(--theme-bg-surface));
  color: var(--color-danger-main);
}
`;
}

export function createBadgeTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from '@/shared/components/Badge';

describe('Badge', () => {
  it('renders the given content', () => {
    render(<Badge tone="success">Stable</Badge>);

    expect(screen.getByText('Stable')).toHaveClass('axi-badge--success');
  });
});
`;
}

export function createCard(): string {
  return `import type { PropsWithChildren, ReactNode } from 'react';

import './card.css';

export interface CardProps extends PropsWithChildren {
  eyebrow?: string;
  footer?: ReactNode;
  title?: string;
}

export function Card({ children, eyebrow, footer, title }: CardProps) {
  return (
    <section className="axi-card">
      {eyebrow || title ? (
        <header className="axi-card__header">
          {eyebrow ? <p className="axi-card__eyebrow">{eyebrow}</p> : null}
          {title ? <h2 className="axi-card__title">{title}</h2> : null}
        </header>
      ) : null}
      <div className="axi-card__body">{children}</div>
      {footer ? <footer className="axi-card__footer">{footer}</footer> : null}
    </section>
  );
}
`;
}

export function createCardStyles(): string {
  return `.axi-card {
  display: grid;
  gap: var(--space-4);
  border: var(--border-width-default) solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--card-padding-x);
  background: var(--color-surface-panel);
  box-shadow: var(--shadow-card);
  backdrop-filter: var(--effect-surface-backdrop);
}

.axi-card__header,
.axi-card__footer {
  display: grid;
  gap: var(--space-2);
}

.axi-card__body {
  display: grid;
  gap: var(--space-3);
}

.axi-card__eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-body-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.axi-card__title {
  margin: 0;
  color: var(--theme-text-primary);
  font-size: var(--font-size-heading-sm);
  font-weight: var(--font-weight-semibold);
}
`;
}

export function createCardTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card } from '@/shared/components/Card';

describe('Card', () => {
  it('renders header, body, and footer slots', () => {
    render(
      <Card eyebrow="Toolkit" footer={<span>Footer</span>} title="Foundation">
        <p>Body</p>
      </Card>,
    );

    expect(screen.getByText('Toolkit')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Foundation' })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});
`;
}

export function createEmptyState(): string {
  return `import type { ReactNode } from 'react';

import './empty-state.css';

export interface EmptyStateProps {
  action?: ReactNode;
  description: string;
  icon?: ReactNode;
  title: string;
}

export function EmptyState({ action, description, icon, title }: EmptyStateProps) {
  return (
    <section className="axi-empty-state">
      {icon ? <div className="axi-empty-state__icon">{icon}</div> : null}
      <div className="axi-empty-state__copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className="axi-empty-state__action">{action}</div> : null}
    </section>
  );
}
`;
}

export function createEmptyStateStyles(): string {
  return `.axi-empty-state {
  display: grid;
  justify-items: center;
  gap: var(--space-4);
  border: var(--border-width-default) dashed var(--theme-border-main);
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  background: var(--theme-bg-elevated);
  text-align: center;
}

.axi-empty-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 999px;
  background: var(--color-surface-spotlight);
  color: var(--color-accent-primary);
}

.axi-empty-state__copy {
  display: grid;
  gap: var(--space-2);
  max-width: 32rem;
}

.axi-empty-state__copy h2,
.axi-empty-state__copy p {
  margin: 0;
}

.axi-empty-state__copy p {
  color: var(--theme-text-secondary);
}
`;
}

export function createEmptyStateTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from '@/shared/components/EmptyState';

describe('EmptyState', () => {
  it('renders title, description, and action', () => {
    render(
      <EmptyState
        action={<button type="button">Retry</button>}
        description="No modules matched the current filter."
        title="Nothing here"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByText('No modules matched the current filter.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
`;
}
