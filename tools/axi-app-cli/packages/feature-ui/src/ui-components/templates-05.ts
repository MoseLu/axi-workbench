export function createBreadcrumbs(): string {
  return `import './breadcrumbs.css';

export interface BreadcrumbItem {
  current?: boolean;
  href?: string;
  label: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="axi-breadcrumbs">
      <ol className="axi-breadcrumbs__list">
        {items.map((item, index) => (
          <li className="axi-breadcrumbs__item" key={\`\${item.label}-\${index}\`}>
            {item.href && !item.current ? (
              <a className="axi-breadcrumbs__link" href={item.href}>
                {item.label}
              </a>
            ) : (
              <span aria-current={item.current ? 'page' : undefined} className="axi-breadcrumbs__current">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
`;
}

export function createBreadcrumbsStyles(): string {
  return `.axi-breadcrumbs__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.axi-breadcrumbs__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
}

.axi-breadcrumbs__item:not(:last-child)::after {
  content: '/';
  color: var(--theme-text-muted);
}

.axi-breadcrumbs__link {
  color: inherit;
  text-decoration: none;
}

.axi-breadcrumbs__link:hover {
  color: var(--theme-text-primary);
}

.axi-breadcrumbs__current {
  color: var(--theme-text-primary);
  font-weight: var(--font-weight-medium);
}
`;
}

export function createBreadcrumbsTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Breadcrumbs } from '@/shared/components/Breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders links and current page marker', () => {
    render(
      <Breadcrumbs
        items={[
          { href: '/workspace', label: 'Workspace' },
          { current: true, label: 'Settings' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Workspace' })).toHaveAttribute('href', '/workspace');
    expect(screen.getByText('Settings')).toHaveAttribute('aria-current', 'page');
  });
});
`;
}

export function createPagination(): string {
  return `import './pagination.css';

export interface PaginationProps {
  currentPage: number;
  onChange?: (page: number) => void;
  totalPages: number;
}

export function Pagination({ currentPage, onChange, totalPages }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination" className="axi-pagination">
      <button
        className="axi-pagination__button"
        disabled={currentPage <= 1}
        onClick={() => onChange?.(currentPage - 1)}
        type="button"
      >
        Previous
      </button>
      <span className="axi-pagination__status">
        Page {currentPage} of {totalPages}
      </span>
      <button
        className="axi-pagination__button"
        disabled={currentPage >= totalPages}
        onClick={() => onChange?.(currentPage + 1)}
        type="button"
      >
        Next
      </button>
    </nav>
  );
}
`;
}

export function createPaginationStyles(): string {
  return `.axi-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.axi-pagination__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  cursor: pointer;
  font: inherit;
}

.axi-pagination__button:disabled {
  opacity: var(--interaction-disabled-opacity);
  cursor: not-allowed;
}

.axi-pagination__status {
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
}
`;
}

export function createPaginationTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from '@/shared/components/Pagination';

describe('Pagination', () => {
  it('renders status and emits page changes', () => {
    const handleChange = vi.fn();

    render(<Pagination currentPage={2} onChange={handleChange} totalPages={4} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Page 2 of 4')).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith(3);
  });
});
`;
}

export function createToast(): string {
  return `import type { ReactNode } from 'react';

import './toast.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastProps {
  action?: ReactNode;
  description?: string;
  title: string;
  tone?: ToastTone;
}

export function Toast({ action, description, title, tone = 'info' }: ToastProps) {
  const role = tone === 'danger' ? 'alert' : 'status';

  return (
    <section className={\`axi-toast axi-toast--\${tone}\`} role={role}>
      <div className="axi-toast__copy">
        <strong className="axi-toast__title">{title}</strong>
        {description ? <p className="axi-toast__description">{description}</p> : null}
      </div>
      {action ? <div className="axi-toast__action">{action}</div> : null}
    </section>
  );
}
`;
}

export function createToastStyles(): string {
  return `.axi-toast {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-4);
  border: var(--border-width-default) solid transparent;
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  background: var(--theme-bg-surface);
  box-shadow: var(--theme-shadow-md);
}

.axi-toast__copy {
  display: grid;
  gap: var(--space-1);
}

.axi-toast__title,
.axi-toast__description {
  margin: 0;
}

.axi-toast__title {
  color: var(--theme-text-primary);
  font-weight: var(--font-weight-semibold);
}

.axi-toast__description {
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
}

.axi-toast--info {
  border-color: color-mix(in srgb, var(--color-info-main) 30%, transparent);
}

.axi-toast--success {
  border-color: color-mix(in srgb, var(--color-success-main) 30%, transparent);
}

.axi-toast--warning {
  border-color: color-mix(in srgb, var(--color-warning-main) 30%, transparent);
}

.axi-toast--danger {
  border-color: color-mix(in srgb, var(--color-danger-main) 30%, transparent);
}
`;
}

export function createToastTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Toast } from '@/shared/components/Toast';

describe('Toast', () => {
  it('renders title, description, and danger role', () => {
    render(<Toast description="Action failed." title="Save error" tone="danger" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Save error');
    expect(screen.getByText('Action failed.')).toBeInTheDocument();
  });
});
`;
}

export function createInputField(): string {
  return `import type { InputHTMLAttributes } from 'react';

import './input-field.css';

export interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function InputField({ className, invalid = false, type = 'text', ...props }: InputFieldProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || props['aria-invalid'] === true ? 'true' : undefined}
      className={['axi-input-field', invalid && 'axi-input-field--invalid', className]
        .filter(Boolean)
        .join(' ')}
      type={type}
    />
  );
}
`;
}

export function createInputFieldStyles(): string {
  return `.axi-input-field {
  width: 100%;
  min-height: var(--form-input-height, 2.75rem);
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  font: inherit;
  transition:
    border-color var(--motion-duration-fast) var(--motion-easing-standard),
    box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
    background-color var(--motion-duration-fast) var(--motion-easing-standard);
}

.axi-input-field::placeholder {
  color: var(--theme-text-muted);
}

.axi-input-field:hover {
  background: var(--theme-bg-hover);
}

.axi-input-field:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.axi-input-field--invalid {
  border-color: var(--color-danger-main);
}
`;
}

export function createInputFieldTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InputField } from '@/shared/components/InputField';

describe('InputField', () => {
  it('renders an accessible invalid input', () => {
    render(<InputField aria-label="Project name" invalid placeholder="Axi" />);

    expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveAttribute('aria-invalid', 'true');
  });
});
`;
}

export function createTextareaField(): string {
  return `import type { TextareaHTMLAttributes } from 'react';

import './textarea-field.css';

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  minRows?: number;
}

export function TextareaField({
  className,
  invalid = false,
  minRows = 4,
  ...props
}: TextareaFieldProps) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || props['aria-invalid'] === true ? 'true' : undefined}
      className={['axi-textarea-field', invalid && 'axi-textarea-field--invalid', className]
        .filter(Boolean)
        .join(' ')}
      rows={props.rows ?? minRows}
    />
  );
}
`;
}

export function createTextareaFieldStyles(): string {
  return `.axi-textarea-field {
  width: 100%;
  min-height: 7rem;
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  font: inherit;
  line-height: var(--font-line-height-normal, 1.5);
  resize: vertical;
  transition:
    border-color var(--motion-duration-fast) var(--motion-easing-standard),
    box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
    background-color var(--motion-duration-fast) var(--motion-easing-standard);
}

.axi-textarea-field::placeholder {
  color: var(--theme-text-muted);
}

.axi-textarea-field:hover {
  background: var(--theme-bg-hover);
}

.axi-textarea-field:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.axi-textarea-field--invalid {
  border-color: var(--color-danger-main);
}
`;
}

export function createTextareaFieldTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TextareaField } from '@/shared/components/TextareaField';

describe('TextareaField', () => {
  it('renders a multiline field with the requested row count', () => {
    render(<TextareaField aria-label="Summary" minRows={6} />);

    expect(screen.getByRole('textbox', { name: 'Summary' })).toHaveAttribute('rows', '6');
  });
});
`;
}

export function createSwitch(): string {
  return `import './switch.css';

export interface SwitchProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({ checked, disabled = false, label, onCheckedChange }: SwitchProps) {
  return (
    <label className="axi-switch">
      <span className="axi-switch__label">{label}</span>
      <button
        aria-checked={checked}
        aria-label={label}
        className="axi-switch__control"
        data-checked={checked ? 'true' : 'false'}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        role="switch"
        type="button"
      >
        <span className="axi-switch__thumb" />
      </button>
    </label>
  );
}
`;
}
