export function createButtonStyles(): string {
  return `.axi-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--button-icon-gap, var(--button-padding-y-sm, 0.5rem));
  min-height: var(--form-input-height, 2.5rem);
  border: var(--border-width-default) solid transparent;
  border-radius: var(--radius-md);
  padding: var(--button-padding-y-md, 0.5rem) var(--button-padding-x-md, 1rem);
  background: var(--theme-button-primary-bg);
  color: var(--theme-button-primary-text);
  box-shadow: var(--theme-shadow-sm);
  cursor: pointer;
  font: inherit;
  font-weight: var(--font-weight-medium);
  line-height: var(--font-line-height-normal, 1.5);
  text-decoration: none;
  transition:
    background-color var(--motion-duration-fast) var(--motion-easing-standard),
    border-color var(--motion-duration-fast) var(--motion-easing-standard),
    box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
    color var(--motion-duration-fast) var(--motion-easing-standard),
    transform var(--motion-duration-fast) var(--motion-easing-standard);
}

.axi-button:hover {
  transform: translateY(var(--interaction-hover-lift));
  box-shadow: var(--shadow-button-hover, var(--theme-shadow-md));
}

.axi-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.axi-button:disabled,
.axi-button[aria-disabled='true'] {
  cursor: not-allowed;
  opacity: var(--interaction-disabled-opacity);
  transform: none;
}

.axi-button--primary {
  background: var(--theme-button-primary-bg);
  color: var(--theme-button-primary-text);
}

.axi-button--secondary {
  background: var(--theme-bg-active);
  color: var(--theme-text-primary);
}

.axi-button--outline {
  background: transparent;
  border-color: var(--theme-border-main);
  color: var(--theme-text-primary);
}

.axi-button--ghost {
  background: transparent;
  color: var(--theme-text-primary);
  box-shadow: none;
}

.axi-button--danger {
  background: var(--color-state-error, var(--color-danger-main));
  color: var(--theme-text-inverse);
}

.axi-button--success {
  background: var(--color-state-success, var(--color-success-main));
  color: var(--theme-text-inverse);
}

.axi-button--sm {
  min-height: 2rem;
  padding: var(--button-padding-y-sm, 0.25rem) var(--button-padding-x-sm, 0.75rem);
  font-size: var(--font-size-body-sm);
}

.axi-button--md {
  min-height: var(--form-input-height, 2.5rem);
}

.axi-button--lg {
  min-height: 3rem;
  padding: var(--button-padding-y-lg, 0.75rem) var(--button-padding-x-lg, 1.5rem);
  font-size: var(--font-size-body-lg);
}

.axi-button--pill {
  border-radius: 999px;
}

.axi-button--block {
  width: 100%;
}

.axi-button__icon,
.axi-button__label {
  display: inline-flex;
  align-items: center;
}

.axi-button__spinner {
  width: 0.875rem;
  height: 0.875rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 999px;
  animation: axi-button-spin 0.75s linear infinite;
}

@keyframes axi-button-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
`;
}

export function createButtonTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/shared/components/Button';

describe('Button', () => {
  it('renders a native button and fires clicks', () => {
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Create</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders an anchor when href is provided', () => {
    render(
      <Button href="/docs" variant="outline">
        Docs
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
  });
});
`;
}

export function createTopbar(): string {
  return `import type { ReactNode } from 'react';

import './topbar.css';

export interface TopbarItem {
  active?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onSelect?: () => void;
}

export interface TopbarProps {
  items?: TopbarItem[];
  leftSlot?: ReactNode;
  logo?: ReactNode;
  rightSlot?: ReactNode;
  title: string;
}

export function Topbar({ items = [], leftSlot, logo, rightSlot, title }: TopbarProps) {
  return (
    <header className="axi-topbar">
      <div className="axi-topbar__inner">
        <div className="axi-topbar__left">
          {logo ? <div className="axi-topbar__logo">{logo}</div> : null}
          <div className="axi-topbar__title-group">
            <strong className="axi-topbar__title">{title}</strong>
            {leftSlot}
          </div>
        </div>

        {items.length > 0 ? (
          <nav aria-label="Primary" className="axi-topbar__nav">
            {items.map((item) => (
              <button
                aria-current={item.active ? 'page' : undefined}
                className="axi-topbar__item"
                data-active={item.active ? 'true' : 'false'}
                disabled={item.disabled}
                key={item.label}
                onClick={item.onSelect}
                type="button"
              >
                {item.icon ? <span className="axi-topbar__item-icon">{item.icon}</span> : null}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        ) : null}

        <div className="axi-topbar__right">{rightSlot}</div>
      </div>
    </header>
  );
}
`;
}

export function createTopbarStyles(): string {
  return `.axi-topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky, 1020);
  min-height: var(--topbar-height, 4rem);
  border-bottom: 1px solid var(--theme-border-light);
  background: var(--theme-glass-bg);
  backdrop-filter: blur(20px);
  box-shadow: var(--theme-shadow-sm);
}

.axi-topbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--topbar-item-gap, 1rem);
  min-height: inherit;
  padding: var(--topbar-padding-y, 1rem) var(--topbar-padding-x, 2rem);
}

.axi-topbar__left,
.axi-topbar__right,
.axi-topbar__nav {
  display: flex;
  align-items: center;
  gap: var(--topbar-item-gap, 1rem);
}

.axi-topbar__left,
.axi-topbar__right {
  flex: 1 1 0;
}

.axi-topbar__right {
  justify-content: flex-end;
}

.axi-topbar__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: var(--theme-text-primary);
}

.axi-topbar__title-group {
  display: grid;
  gap: var(--space-1);
}

.axi-topbar__title {
  color: var(--theme-text-primary);
  font-size: var(--font-size-heading-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1.1;
}

.axi-topbar__nav {
  gap: var(--topbar-button-gap, 2rem);
}

.axi-topbar__item {
  display: inline-flex;
  align-items: center;
  gap: var(--button-icon-gap, 0.5rem);
  border: none;
  border-radius: 999px;
  padding: var(--button-padding-y-sm, 0.25rem) var(--button-padding-x-md, 1rem);
  background: transparent;
  color: var(--theme-text-secondary);
  cursor: pointer;
  font: inherit;
  transition:
    background-color var(--motion-duration-fast) var(--motion-easing-standard),
    color var(--motion-duration-fast) var(--motion-easing-standard),
    transform var(--motion-duration-fast) var(--motion-easing-standard);
}

.axi-topbar__item:hover {
  transform: translateY(var(--interaction-hover-lift));
  background: var(--theme-bg-hover);
  color: var(--theme-text-primary);
}

.axi-topbar__item[data-active='true'] {
  background: var(--color-surface-tag);
  color: var(--color-accent-primary);
}

.axi-topbar__item:disabled {
  opacity: var(--interaction-disabled-opacity);
  cursor: not-allowed;
  transform: none;
}

.axi-topbar__item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.axi-topbar__item-icon {
  display: inline-flex;
  align-items: center;
}

@media (max-width: 64rem) {
  .axi-topbar__inner {
    flex-wrap: wrap;
  }

  .axi-topbar__nav {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
  }
}
`;
}

export function createTopbarTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Topbar } from '@/shared/components/Topbar';

describe('Topbar', () => {
  it('renders title and navigation items', () => {
    const handleSelect = vi.fn();

    render(
      <Topbar
        items={[
          { active: true, label: 'Overview', onSelect: handleSelect },
          { label: 'Settings' },
        ]}
        title="Workspace"
      />,
    );

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));

    expect(handleSelect).toHaveBeenCalledTimes(1);
  });
});
`;
}

export function createAccordion(): string {
  return `import type { ReactNode } from 'react';

import './accordion.css';

export interface AccordionItem {
  content: ReactNode;
  description?: string;
  title: string;
  value: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  onToggle?: (value: string, nextOpen: boolean) => void;
  openValues?: string[];
}

export function Accordion({ items, onToggle, openValues }: AccordionProps) {
  const resolvedOpenValues = openValues ?? (items[0] ? [items[0].value] : []);

  return (
    <div className="axi-accordion">
      {items.map((item) => {
        const isOpen = resolvedOpenValues.includes(item.value);

        return (
          <section className="axi-accordion__item" key={item.value}>
            <button
              aria-controls={\`axi-accordion-panel-\${item.value}\`}
              aria-expanded={isOpen}
              className="axi-accordion__trigger"
              id={\`axi-accordion-trigger-\${item.value}\`}
              onClick={() => onToggle?.(item.value, !isOpen)}
              type="button"
            >
              <span className="axi-accordion__copy">
                <span className="axi-accordion__title">{item.title}</span>
                {item.description ? <span className="axi-accordion__description">{item.description}</span> : null}
              </span>
              <span aria-hidden="true" className="axi-accordion__indicator">
                {isOpen ? '−' : '+'}
              </span>
            </button>
            {isOpen ? (
              <div
                aria-labelledby={\`axi-accordion-trigger-\${item.value}\`}
                className="axi-accordion__panel"
                id={\`axi-accordion-panel-\${item.value}\`}
              >
                {item.content}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
`;
}

export function createAccordionStyles(): string {
  return `.axi-accordion {
  display: grid;
  gap: var(--space-3);
}

.axi-accordion__item {
  overflow: hidden;
  border: var(--border-width-default) solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface-panel);
}

.axi-accordion__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  width: 100%;
  border: none;
  padding: var(--space-4) var(--space-5);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.axi-accordion__copy {
  display: grid;
  gap: var(--space-1);
}

.axi-accordion__title {
  color: var(--theme-text-primary);
  font-weight: var(--font-weight-semibold);
}

.axi-accordion__description {
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
}

.axi-accordion__indicator {
  color: var(--color-accent-primary);
  font-size: var(--font-size-heading-sm);
  font-weight: var(--font-weight-semibold);
}

.axi-accordion__panel {
  padding: 0 var(--space-5) var(--space-5);
  color: var(--theme-text-secondary);
}
`;
}

export function createAccordionTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Accordion } from '@/shared/components/Accordion';

describe('Accordion', () => {
  it('renders the open panel and emits toggle intents', () => {
    const handleToggle = vi.fn();

    render(
      <Accordion
        items={[
          { content: <p>Overview panel</p>, title: 'Overview', value: 'overview' },
          { content: <p>Settings panel</p>, title: 'Settings', value: 'settings' },
        ]}
        onToggle={handleToggle}
        openValues={['overview']}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    expect(screen.getByText('Overview panel')).toBeInTheDocument();
    expect(handleToggle).toHaveBeenCalledWith('settings', true);
  });
});
`;
}
