export function createSkeletonStyles(): string {
  return `.axi-skeleton {
  display: grid;
  gap: var(--space-2);
  width: var(--axi-skeleton-width);
}

.axi-skeleton__line {
  display: block;
  width: 100%;
  min-height: var(--axi-skeleton-height);
  border-radius: var(--axi-skeleton-radius);
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--theme-bg-active) 82%, transparent) 0%,
      color-mix(in srgb, var(--theme-bg-hover) 88%, transparent) 50%,
      color-mix(in srgb, var(--theme-bg-active) 82%, transparent) 100%
    );
  background-size: 200% 100%;
  animation: axi-skeleton-wave 1.2s ease-in-out infinite;
}

.axi-skeleton[data-lines='1'] .axi-skeleton__line:last-child {
  width: 100%;
}

.axi-skeleton[data-lines='2'] .axi-skeleton__line:last-child,
.axi-skeleton[data-lines='3'] .axi-skeleton__line:last-child,
.axi-skeleton[data-lines='4'] .axi-skeleton__line:last-child {
  width: 72%;
}

@keyframes axi-skeleton-wave {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}
`;
}

export function createSkeletonTest(): string {
  return `import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from '@/shared/components/Skeleton';

describe('Skeleton', () => {
  it('renders the requested number of lines', () => {
    const { container } = render(<Skeleton lines={3} />);

    expect(container.querySelectorAll('.axi-skeleton__line')).toHaveLength(3);
  });
});
`;
}

export function createTabs(): string {
  return `import type { ReactNode } from 'react';

import './tabs.css';

export interface TabItem {
  badge?: ReactNode;
  description?: string;
  disabled?: boolean;
  label: string;
  panel: ReactNode;
  value: string;
}

export interface TabsProps {
  ariaLabel?: string;
  items: TabItem[];
  onChange?: (value: string) => void;
  value?: string;
}

export function Tabs({ ariaLabel = 'Tabs', items, onChange, value }: TabsProps) {
  const activeItem =
    items.find((item) => item.value === value && !item.disabled) ??
    items.find((item) => !item.disabled) ??
    items[0];

  if (!activeItem) {
    return null;
  }

  return (
    <section className="axi-tabs">
      <div aria-label={ariaLabel} className="axi-tabs__list" role="tablist">
        {items.map((item) => {
          const isActive = item.value === activeItem.value;
          return (
            <button
              aria-controls={\`axi-tab-panel-\${item.value}\`}
              aria-selected={isActive}
              className="axi-tabs__tab"
              data-active={isActive ? 'true' : 'false'}
              disabled={item.disabled}
              id={\`axi-tab-\${item.value}\`}
              key={item.value}
              onClick={() => {
                if (!item.disabled) {
                  onChange?.(item.value);
                }
              }}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <span>{item.label}</span>
              {item.badge ? <span className="axi-tabs__badge">{item.badge}</span> : null}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={\`axi-tab-\${activeItem.value}\`}
        className="axi-tabs__panel"
        id={\`axi-tab-panel-\${activeItem.value}\`}
        role="tabpanel"
      >
        {activeItem.description ? <p className="axi-tabs__description">{activeItem.description}</p> : null}
        <div className="axi-tabs__content">{activeItem.panel}</div>
      </div>
    </section>
  );
}
`;
}

export function createTabsStyles(): string {
  return `.axi-tabs {
  display: grid;
  gap: var(--space-4);
}

.axi-tabs__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.axi-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border: var(--border-width-default) solid var(--theme-border-light);
  border-radius: 999px;
  padding: var(--space-2) var(--space-4);
  background: var(--theme-bg-surface);
  color: var(--theme-text-secondary);
  cursor: pointer;
  font: inherit;
  transition:
    background-color var(--motion-duration-fast) var(--motion-easing-standard),
    border-color var(--motion-duration-fast) var(--motion-easing-standard),
    color var(--motion-duration-fast) var(--motion-easing-standard),
    transform var(--motion-duration-fast) var(--motion-easing-standard);
}

.axi-tabs__tab:hover {
  transform: translateY(var(--interaction-hover-lift));
  color: var(--theme-text-primary);
}

.axi-tabs__tab[data-active='true'] {
  border-color: color-mix(in srgb, var(--color-accent-primary) 35%, transparent);
  background: var(--color-surface-tag);
  color: var(--color-accent-primary);
}

.axi-tabs__tab:disabled {
  opacity: var(--interaction-disabled-opacity);
  cursor: not-allowed;
  transform: none;
}

.axi-tabs__panel {
  display: grid;
  gap: var(--space-3);
  border: var(--border-width-default) solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--card-padding-y) var(--card-padding-x);
  background: var(--color-surface-panel);
}

.axi-tabs__description {
  margin: 0;
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
}

.axi-tabs__content {
  display: grid;
  gap: var(--space-3);
}
`;
}

export function createTabsTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Tabs } from '@/shared/components/Tabs';

describe('Tabs', () => {
  it('renders the active tab panel and notifies on change', () => {
    const handleChange = vi.fn();

    render(
      <Tabs
        items={[
          { label: 'Overview', panel: <p>Overview panel</p>, value: 'overview' },
          { label: 'Settings', panel: <p>Settings panel</p>, value: 'settings' },
        ]}
        onChange={handleChange}
        value="overview"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));

    expect(screen.getByRole('tabpanel')).toHaveTextContent('Overview panel');
    expect(handleChange).toHaveBeenCalledWith('settings');
  });
});
`;
}

export function createTooltip(): string {
  return `import type { PropsWithChildren, ReactNode } from 'react';

import './tooltip.css';

export type TooltipSide = 'top' | 'bottom';

export interface TooltipProps extends PropsWithChildren {
  content: ReactNode;
  side?: TooltipSide;
}

export function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  return (
    <span className={\`axi-tooltip axi-tooltip--\${side}\`}>
      <span className="axi-tooltip__trigger" tabIndex={0}>
        {children}
      </span>
      <span className="axi-tooltip__content" role="tooltip">
        {content}
      </span>
    </span>
  );
}
`;
}

export function createTooltipStyles(): string {
  return `.axi-tooltip {
  position: relative;
  display: inline-flex;
}

.axi-tooltip__trigger {
  display: inline-flex;
}

.axi-tooltip__content {
  position: absolute;
  left: 50%;
  z-index: var(--z-tooltip, 1070);
  min-width: max-content;
  max-width: 18rem;
  border: var(--border-width-default) solid var(--theme-border-light);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: var(--theme-bg-inverse);
  color: var(--theme-text-inverse);
  box-shadow: var(--theme-shadow-md);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(0.25rem);
  transition:
    opacity var(--motion-duration-fast) var(--motion-easing-standard),
    transform var(--motion-duration-fast) var(--motion-easing-standard);
}

.axi-tooltip--top .axi-tooltip__content {
  bottom: calc(100% + var(--space-2));
}

.axi-tooltip--bottom .axi-tooltip__content {
  top: calc(100% + var(--space-2));
}

.axi-tooltip:hover .axi-tooltip__content,
.axi-tooltip:focus-within .axi-tooltip__content {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
`;
}

export function createTooltipTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Tooltip } from '@/shared/components/Tooltip';

describe('Tooltip', () => {
  it('renders trigger and tooltip content', () => {
    render(
      <Tooltip content="Sync the latest scaffold state">
        <button type="button">Help</button>
      </Tooltip>,
    );

    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Sync the latest scaffold state');
  });
});
`;
}

export function createFormField(): string {
  return `import type { PropsWithChildren, ReactNode } from 'react';

import './form-field.css';

export interface FormFieldProps extends PropsWithChildren {
  action?: ReactNode;
  error?: string;
  hint?: string;
  htmlFor?: string;
  label: string;
  required?: boolean;
}

export function FormField({
  action,
  children,
  error,
  hint,
  htmlFor,
  label,
  required = false,
}: FormFieldProps) {
  return (
    <div className="axi-form-field">
      <div className="axi-form-field__header">
        <label className="axi-form-field__label" htmlFor={htmlFor}>
          <span>{label}</span>
          {required ? <span className="axi-form-field__required">*</span> : null}
        </label>
        {action ? <div className="axi-form-field__action">{action}</div> : null}
      </div>
      <div className="axi-form-field__control">{children}</div>
      {error ? (
        <p className="axi-form-field__feedback axi-form-field__feedback--error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="axi-form-field__feedback">{hint}</p>
      ) : null}
    </div>
  );
}
`;
}

export function createFormFieldStyles(): string {
  return `.axi-form-field {
  display: grid;
  gap: var(--space-2);
}

.axi-form-field__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.axi-form-field__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--theme-text-primary);
  font-size: var(--font-size-body-sm);
  font-weight: var(--font-weight-medium);
}

.axi-form-field__required {
  color: var(--color-danger-main);
}

.axi-form-field__control {
  display: grid;
  gap: var(--space-2);
}

.axi-form-field__feedback {
  margin: 0;
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
}

.axi-form-field__feedback--error {
  color: var(--color-danger-main);
}
`;
}

export function createFormFieldTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormField } from '@/shared/components/FormField';

describe('FormField', () => {
  it('renders label, control, and error feedback', () => {
    render(
      <FormField error="Name is required" htmlFor="project-name" label="Project name" required>
        <input id="project-name" />
      </FormField>,
    );

    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  });
});
`;
}
