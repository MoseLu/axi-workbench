export function createDropdownMenu(): string {
  return `import './dropdown-menu.css';

export interface DropdownMenuItem {
  disabled?: boolean;
  id: string;
  label: string;
}

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  label: string;
  onSelect?: (id: string) => void;
  onToggle?: () => void;
  open: boolean;
}

export function DropdownMenu({ items, label, onSelect, onToggle, open }: DropdownMenuProps) {
  return (
    <div className="axi-dropdown-menu">
      <button className="axi-dropdown-menu__trigger" onClick={onToggle} type="button">
        {label}
      </button>
      {open ? (
        <ul className="axi-dropdown-menu__content">
          {items.map((item) => (
            <li key={item.id}>
              <button
                className="axi-dropdown-menu__item"
                disabled={item.disabled}
                onClick={() => onSelect?.(item.id)}
                type="button"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
`;
}

export function createDropdownMenuStyles(): string {
  return `.axi-dropdown-menu {
  position: relative;
  display: inline-grid;
  gap: var(--space-2);
}

.axi-dropdown-menu__trigger {
  min-height: var(--button-height-md, 2.75rem);
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: 0 var(--space-4);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  cursor: pointer;
  font: inherit;
}

.axi-dropdown-menu__content {
  position: absolute;
  top: calc(100% + var(--space-2));
  left: 0;
  display: grid;
  gap: var(--space-1);
  min-width: 12rem;
  margin: 0;
  padding: var(--space-2);
  list-style: none;
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-lg);
  background: var(--theme-bg-elevated);
  box-shadow: var(--shadow-popup);
}

.axi-dropdown-menu__item {
  width: 100%;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  color: var(--theme-text-primary);
  cursor: pointer;
  text-align: left;
}
`;
}

export function createDropdownMenuTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DropdownMenu } from '@/shared/components/DropdownMenu';

describe('DropdownMenu', () => {
  it('renders items when open and emits select', () => {
    const handleSelect = vi.fn();

    render(
      <DropdownMenu
        items={[{ id: 'copy', label: 'Copy' }]}
        label="Actions"
        onSelect={handleSelect}
        open
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(handleSelect).toHaveBeenCalledWith('copy');
  });
});
`;
}

export function createEmptySearchState(): string {
  return `import './empty-search-state.css';

export interface EmptySearchStateProps {
  onReset?: () => void;
  query?: string;
}

export function EmptySearchState({ onReset, query = '' }: EmptySearchStateProps) {
  return (
    <section className="axi-empty-search-state">
      <h2>No results</h2>
      <p>
        No items matched <strong>{query || 'the current search'}</strong>.
      </p>
      {onReset ? (
        <button className="axi-empty-search-state__action" onClick={onReset} type="button">
          Clear filters
        </button>
      ) : null}
    </section>
  );
}
`;
}

export function createEmptySearchStateStyles(): string {
  return `.axi-empty-search-state {
  display: grid;
  gap: var(--space-3);
  justify-items: center;
  border: var(--border-width-default) dashed var(--theme-border-main);
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  background: var(--theme-bg-elevated);
  text-align: center;
}

.axi-empty-search-state h2,
.axi-empty-search-state p {
  margin: 0;
}

.axi-empty-search-state__action {
  min-height: var(--button-height-md, 2.75rem);
  border: none;
  border-radius: var(--radius-md);
  padding: 0 var(--space-4);
  background: var(--color-accent-primary);
  color: var(--theme-text-inverse);
  cursor: pointer;
  font: inherit;
}
`;
}

export function createEmptySearchStateTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmptySearchState } from '@/shared/components/EmptySearchState';

describe('EmptySearchState', () => {
  it('renders the query and reset action', () => {
    const handleReset = vi.fn();

    render(<EmptySearchState onReset={handleReset} query="hooks" />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('hooks')).toBeInTheDocument();
    expect(handleReset).toHaveBeenCalled();
  });
});
`;
}

export function createInlineActions(): string {
  return `import './inline-actions.css';

export interface InlineActionItem {
  disabled?: boolean;
  id: string;
  label: string;
}

export interface InlineActionsProps {
  items: InlineActionItem[];
  onSelect?: (id: string) => void;
}

export function InlineActions({ items, onSelect }: InlineActionsProps) {
  return (
    <div className="axi-inline-actions">
      {items.map((item) => (
        <button
          className="axi-inline-actions__item"
          disabled={item.disabled}
          key={item.id}
          onClick={() => onSelect?.(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
`;
}

export function createInlineActionsStyles(): string {
  return `.axi-inline-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.axi-inline-actions__item {
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  cursor: pointer;
  font: inherit;
}
`;
}

export function createInlineActionsTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InlineActions } from '@/shared/components/InlineActions';

describe('InlineActions', () => {
  it('emits the selected action id', () => {
    const handleSelect = vi.fn();

    render(<InlineActions items={[{ id: 'edit', label: 'Edit' }]} onSelect={handleSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(handleSelect).toHaveBeenCalledWith('edit');
  });
});
`;
}

export function createSpinner(): string {
  return `import './spinner.css';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  label?: string;
  size?: SpinnerSize;
}

export function Spinner({ label = 'Loading', size = 'md' }: SpinnerProps) {
  return <span aria-label={label} className={\`axi-spinner axi-spinner--\${size}\`} role="status" />;
}
`;
}

export function createSpinnerStyles(): string {
  return `.axi-spinner {
  display: inline-block;
  border: 2px solid color-mix(in srgb, var(--theme-border-main) 45%, transparent);
  border-top-color: var(--color-accent-primary);
  border-radius: 999px;
  animation: axi-spinner-spin 0.8s linear infinite;
}

.axi-spinner--sm {
  width: 1rem;
  height: 1rem;
}

.axi-spinner--md {
  width: 1.5rem;
  height: 1.5rem;
}

.axi-spinner--lg {
  width: 2rem;
  height: 2rem;
}

@keyframes axi-spinner-spin {
  to {
    transform: rotate(360deg);
  }
}
`;
}

export function createSpinnerTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner } from '@/shared/components/Spinner';

describe('Spinner', () => {
  it('renders a status indicator', () => {
    render(<Spinner label="Syncing" size="lg" />);

    expect(screen.getByRole('status', { name: 'Syncing' })).toHaveClass('axi-spinner--lg');
  });
});
`;
}

export function createStatCard(): string {
  return `import './stat-card.css';

export interface StatCardProps {
  label: string;
  meta?: string;
  value: string;
}

export function StatCard({ label, meta, value }: StatCardProps) {
  return (
    <section className="axi-stat-card">
      <p className="axi-stat-card__label">{label}</p>
      <strong className="axi-stat-card__value">{value}</strong>
      {meta ? <span className="axi-stat-card__meta">{meta}</span> : null}
    </section>
  );
}
`;
}

export function createStatCardStyles(): string {
  return `.axi-stat-card {
  display: grid;
  gap: var(--space-2);
  border: var(--border-width-default) solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--theme-bg-surface);
}

.axi-stat-card__label,
.axi-stat-card__meta {
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
}

.axi-stat-card__value {
  color: var(--theme-text-primary);
  font-size: var(--font-size-heading-md);
}
`;
}

export function createStatCardTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatCard } from '@/shared/components/StatCard';

describe('StatCard', () => {
  it('renders label, value, and meta', () => {
    render(<StatCard label="Resources" meta="+12 this week" value="128" />);

    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('+12 this week')).toBeInTheDocument();
  });
});
`;
}

export function createStatusDot(): string {
  return `import './status-dot.css';

export type StatusDotTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface StatusDotProps {
  label: string;
  tone?: StatusDotTone;
}

export function StatusDot({ label, tone = 'default' }: StatusDotProps) {
  return (
    <span className={\`axi-status-dot axi-status-dot--\${tone}\`}>
      <span aria-hidden="true" className="axi-status-dot__bullet" />
      <span>{label}</span>
    </span>
  );
}
`;
}

export function createStatusDotStyles(): string {
  return `.axi-status-dot {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--theme-text-primary);
  font-size: var(--font-size-body-sm);
}

.axi-status-dot__bullet {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 999px;
  background: var(--theme-border-main);
}

.axi-status-dot--success .axi-status-dot__bullet {
  background: var(--color-success-main);
}

.axi-status-dot--warning .axi-status-dot__bullet {
  background: var(--color-warning-main);
}

.axi-status-dot--danger .axi-status-dot__bullet {
  background: var(--color-danger-main);
}

.axi-status-dot--info .axi-status-dot__bullet {
  background: var(--color-info-main);
}
`;
}

export function createStatusDotTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusDot } from '@/shared/components/StatusDot';

describe('StatusDot', () => {
  it('renders label text with tone class', () => {
    render(<StatusDot label="Healthy" tone="success" />);

    expect(screen.getByText('Healthy').closest('.axi-status-dot')).toHaveClass('axi-status-dot--success');
  });
});
`;
}

export function createTagPicker(): string {
  return `import './tag-picker.css';

export interface TagPickerOption {
  label: string;
  value: string;
}

export interface TagPickerProps {
  onToggle?: (value: string) => void;
  options: TagPickerOption[];
  values: string[];
}

export function TagPicker({ onToggle, options, values }: TagPickerProps) {
  return (
    <div className="axi-tag-picker">
      {options.map((option) => {
        const selected = values.includes(option.value);

        return (
          <button
            className="axi-tag-picker__tag"
            data-selected={selected ? 'true' : 'false'}
            key={option.value}
            onClick={() => onToggle?.(option.value)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
`;
}
