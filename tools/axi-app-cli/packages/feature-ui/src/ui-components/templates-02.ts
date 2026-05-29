export function createButton(): string {
  return `import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import './button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonShape = 'default' | 'pill';

interface CommonButtonProps {
  block?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  shape?: ButtonShape;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

type AnchorButtonProps = CommonButtonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type NativeButtonProps = CommonButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

export type ButtonProps = AnchorButtonProps | NativeButtonProps;

function joinClassNames(values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function renderButtonContent(
  children: ReactNode,
  icon: ReactNode | undefined,
  iconPosition: 'left' | 'right',
  loading: boolean,
) {
  return (
    <>
      {loading ? <span aria-hidden="true" className="axi-button__spinner" /> : null}
      {icon && iconPosition === 'left' ? <span className="axi-button__icon">{icon}</span> : null}
      {children ? <span className="axi-button__label">{children}</span> : null}
      {icon && iconPosition === 'right' ? <span className="axi-button__icon">{icon}</span> : null}
    </>
  );
}

export function Button(props: ButtonProps) {
  const {
    block = false,
    children,
    className,
    href,
    icon,
    iconPosition = 'left',
    loading = false,
    shape = 'default',
    size = 'md',
    variant = 'primary',
    ...rest
  } = props;

  const classes = joinClassNames([
    'axi-button',
    \`axi-button--\${variant}\`,
    \`axi-button--\${size}\`,
    \`axi-button--\${shape}\`,
    block && 'axi-button--block',
    loading && 'axi-button--loading',
    className,
  ]);
  const content = renderButtonContent(children, icon, iconPosition, loading);

  if (href) {
    return (
      <a
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
        aria-disabled={loading ? 'true' : undefined}
        className={classes}
        href={href}
      >
        {content}
      </a>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button
      {...buttonProps}
      aria-busy={loading}
      className={classes}
      disabled={buttonProps.disabled || loading}
      type={buttonProps.type ?? 'button'}
    >
      {content}
    </button>
  );
}
`;
}

export function createModal(): string {
  return `import type { PropsWithChildren, ReactNode } from 'react';

import './modal.css';

export interface ModalProps extends PropsWithChildren {
  footer?: ReactNode;
  onClose?: () => void;
  open: boolean;
  title: string;
}

export function Modal({ children, footer, onClose, open, title }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="axi-modal__overlay" onClick={onClose} role="presentation">
      <section
        aria-modal="true"
        aria-label={title}
        className="axi-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="axi-modal__header">
          <h2>{title}</h2>
          {onClose ? (
            <button aria-label="Close modal" className="axi-modal__close" onClick={onClose} type="button">
              ×
            </button>
          ) : null}
        </header>
        <div className="axi-modal__body">{children}</div>
        {footer ? <footer className="axi-modal__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
`;
}

export function createModalStyles(): string {
  return `.axi-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop, 1040);
  display: grid;
  place-items: center;
  padding: var(--space-6);
  background: var(--theme-bg-overlay);
}

.axi-modal {
  width: min(100%, var(--modal-width-md, 35rem));
  display: grid;
  gap: var(--space-4);
  border: var(--border-width-default) solid var(--theme-border-light);
  border-radius: var(--radius-lg);
  background: var(--theme-bg-surface);
  box-shadow: var(--theme-shadow-xl);
}

.axi-modal__header,
.axi-modal__body,
.axi-modal__footer {
  padding-inline: var(--modal-body-padding-x, 1.5rem);
}

.axi-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--modal-header-padding-y, 1.25rem);
}

.axi-modal__body {
  display: grid;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
}

.axi-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-bottom: var(--modal-footer-padding-y, 1rem);
}

.axi-modal__header h2 {
  margin: 0;
  font-size: var(--font-size-heading-sm);
}

.axi-modal__close {
  border: none;
  background: transparent;
  color: var(--theme-text-secondary);
  cursor: pointer;
  font-size: 1.5rem;
}
`;
}

export function createModalTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '@/shared/components/Modal';

describe('Modal', () => {
  it('renders only when open and calls onClose', () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal onClose={handleClose} open={false} title="Release notes">
        Hidden
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(
      <Modal onClose={handleClose} open title="Release notes">
        Visible
      </Modal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    expect(screen.getByRole('dialog', { name: 'Release notes' })).toBeInTheDocument();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
`;
}

export function createDrawer(): string {
  return `import type { PropsWithChildren, ReactNode } from 'react';

import './drawer.css';

export type DrawerPlacement = 'left' | 'right';

export interface DrawerProps extends PropsWithChildren {
  footer?: ReactNode;
  onClose?: () => void;
  open: boolean;
  placement?: DrawerPlacement;
  title: string;
}

export function Drawer({
  children,
  footer,
  onClose,
  open,
  placement = 'right',
  title,
}: DrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="axi-drawer__overlay" onClick={onClose} role="presentation">
      <section
        aria-modal="true"
        aria-label={title}
        className={\`axi-drawer axi-drawer--\${placement}\`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="axi-drawer__header">
          <h2>{title}</h2>
          {onClose ? (
            <button aria-label="Close drawer" className="axi-drawer__close" onClick={onClose} type="button">
              ×
            </button>
          ) : null}
        </header>
        <div className="axi-drawer__body">{children}</div>
        {footer ? <footer className="axi-drawer__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
`;
}

export function createDrawerStyles(): string {
  return `.axi-drawer__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop, 1040);
  background: var(--theme-bg-overlay);
}

.axi-drawer {
  position: absolute;
  top: 0;
  bottom: 0;
  width: min(100%, 28rem);
  display: grid;
  gap: var(--space-4);
  border: var(--border-width-default) solid var(--theme-border-light);
  background: var(--theme-bg-surface);
  box-shadow: var(--theme-shadow-xl);
}

.axi-drawer--left {
  left: 0;
}

.axi-drawer--right {
  right: 0;
}

.axi-drawer__header,
.axi-drawer__body,
.axi-drawer__footer {
  padding-inline: var(--space-5);
}

.axi-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-5);
}

.axi-drawer__body {
  display: grid;
  gap: var(--space-3);
  overflow: auto;
}

.axi-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-bottom: var(--space-5);
}

.axi-drawer__header h2 {
  margin: 0;
  font-size: var(--font-size-heading-sm);
}

.axi-drawer__close {
  border: none;
  background: transparent;
  color: var(--theme-text-secondary);
  cursor: pointer;
  font-size: 1.5rem;
}
`;
}

export function createDrawerTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Drawer } from '@/shared/components/Drawer';

describe('Drawer', () => {
  it('renders placement classes and closes', () => {
    const handleClose = vi.fn();

    render(
      <Drawer onClose={handleClose} open placement="left" title="Filters">
        Content
      </Drawer>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));

    expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveClass('axi-drawer--left');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
`;
}

export function createProgress(): string {
  return `import './progress.css';

export interface ProgressProps {
  label?: string;
  max?: number;
  value: number;
}

export function Progress({ label, max = 100, value }: ProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), max);
  const percent = Math.round((clampedValue / max) * 100);

  return (
    <div className="axi-progress">
      {label ? (
        <div className="axi-progress__meta">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
      ) : null}
      <div aria-valuemax={max} aria-valuemin={0} aria-valuenow={clampedValue} className="axi-progress__track" role="progressbar">
        <div className="axi-progress__fill" style={{ width: \`\${percent}%\` }} />
      </div>
    </div>
  );
}
`;
}

export function createProgressStyles(): string {
  return `.axi-progress {
  display: grid;
  gap: var(--space-2);
}

.axi-progress__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
}

.axi-progress__track {
  overflow: hidden;
  width: 100%;
  min-height: 0.625rem;
  border-radius: 999px;
  background: var(--theme-bg-active);
}

.axi-progress__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-accent-primary), var(--color-accent-secondary));
}
`;
}

export function createProgressTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Progress } from '@/shared/components/Progress';

describe('Progress', () => {
  it('clamps values and exposes progressbar semantics', () => {
    render(<Progress label="Coverage" max={80} value={100} />);

    expect(screen.getByText('Coverage')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
  });
});
`;
}

export function createSkeleton(): string {
  return `import type { CSSProperties } from 'react';

import './skeleton.css';

export interface SkeletonProps {
  height?: string;
  lines?: number;
  radius?: string;
  width?: string;
}

export function Skeleton({
  height = '1rem',
  lines = 1,
  radius = 'var(--radius-sm)',
  width = '100%',
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className="axi-skeleton"
      data-lines={lines}
      style={
        {
          '--axi-skeleton-height': height,
          '--axi-skeleton-radius': radius,
          '--axi-skeleton-width': width,
        } as CSSProperties
      }
    >
      {Array.from({ length: lines }, (_, index) => (
        <span className="axi-skeleton__line" key={index} />
      ))}
    </div>
  );
}
`;
}
