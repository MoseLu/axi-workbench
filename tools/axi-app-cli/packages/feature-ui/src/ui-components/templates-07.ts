export function createFileTriggerStyles(): string {
  return `.axi-file-trigger {
  display: inline-flex;
}

.axi-file-trigger__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  border: 0;
  white-space: nowrap;
}

.axi-file-trigger__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--button-height-md, 2.75rem);
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: 0 var(--space-4);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  cursor: pointer;
  font-weight: var(--font-weight-medium);
  transition:
    background-color var(--motion-duration-fast) var(--motion-easing-standard),
    border-color var(--motion-duration-fast) var(--motion-easing-standard);
}

.axi-file-trigger__button:hover {
  border-color: var(--color-accent-primary);
  background: var(--theme-bg-hover);
}
`;
}

export function createFileTriggerTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FileTrigger } from '@/shared/components/FileTrigger';

describe('FileTrigger', () => {
  it('forwards selected files through the callback', () => {
    const handleFilesSelected = vi.fn();

    render(<FileTrigger buttonLabel="Upload asset" onFilesSelected={handleFilesSelected} />);

    const input = screen.getByLabelText('Upload asset');
    const file = new File(['asset'], 'asset.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(handleFilesSelected).toHaveBeenCalled();
  });
});
`;
}

export function createSearchField(): string {
  return `import type { InputHTMLAttributes } from 'react';

import './search-field.css';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  onClear?: () => void;
}

export function SearchField({
  className,
  invalid = false,
  onClear,
  type = 'search',
  value,
  ...props
}: SearchFieldProps) {
  const hasValue = typeof value === 'string' && value.length > 0;

  return (
    <label className={['axi-search-field', invalid && 'axi-search-field--invalid', className]
      .filter(Boolean)
      .join(' ')}>
      <span aria-hidden="true" className="axi-search-field__icon">
        ⌕
      </span>
      <input
        {...props}
        aria-invalid={invalid || props['aria-invalid'] === true ? 'true' : undefined}
        className="axi-search-field__input"
        type={type}
        value={value}
      />
      {hasValue ? (
        <button
          aria-label="Clear search"
          className="axi-search-field__clear"
          onClick={onClear}
          type="button"
        >
          ×
        </button>
      ) : null}
    </label>
  );
}
`;
}

export function createSearchFieldStyles(): string {
  return `.axi-search-field {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--form-input-height, 2.75rem);
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--theme-bg-surface);
}

.axi-search-field:focus-within {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.axi-search-field--invalid {
  border-color: var(--color-danger-main);
}

.axi-search-field__icon,
.axi-search-field__clear {
  color: var(--theme-text-secondary);
}

.axi-search-field__input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--theme-text-primary);
  font: inherit;
}

.axi-search-field__input:focus {
  outline: none;
}

.axi-search-field__clear {
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  line-height: 1;
}
`;
}

export function createSearchFieldTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SearchField } from '@/shared/components/SearchField';

describe('SearchField', () => {
  it('renders a search input and exposes clear action', () => {
    const handleClear = vi.fn();

    render(<SearchField aria-label="Search modules" onClear={handleClear} value="theme" />);

    expect(screen.getByLabelText('Search modules')).toHaveAttribute('type', 'search');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(handleClear).toHaveBeenCalled();
  });
});
`;
}

export function createPasswordField(): string {
  return `import type { InputHTMLAttributes } from 'react';
import { useState } from 'react';

import './password-field.css';

export interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function PasswordField({
  className,
  invalid = false,
  ...props
}: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <label className={['axi-password-field', invalid && 'axi-password-field--invalid', className]
      .filter(Boolean)
      .join(' ')}>
      <input
        {...props}
        aria-invalid={invalid || props['aria-invalid'] === true ? 'true' : undefined}
        className="axi-password-field__input"
        type={revealed ? 'text' : 'password'}
      />
      <button
        aria-label={revealed ? 'Hide password' : 'Show password'}
        className="axi-password-field__toggle"
        onClick={() => setRevealed((current) => !current)}
        type="button"
      >
        {revealed ? 'Hide' : 'Show'}
      </button>
    </label>
  );
}
`;
}

export function createPasswordFieldStyles(): string {
  return `.axi-password-field {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--form-input-height, 2.75rem);
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--theme-bg-surface);
}

.axi-password-field:focus-within {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.axi-password-field--invalid {
  border-color: var(--color-danger-main);
}

.axi-password-field__input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--theme-text-primary);
  font: inherit;
}

.axi-password-field__input:focus {
  outline: none;
}

.axi-password-field__toggle {
  border: none;
  background: transparent;
  color: var(--color-accent-primary);
  cursor: pointer;
  font: inherit;
  font-weight: var(--font-weight-medium);
}
`;
}

export function createPasswordFieldTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PasswordField } from '@/shared/components/PasswordField';

describe('PasswordField', () => {
  it('toggles password visibility', () => {
    render(<PasswordField aria-label="API token" />);

    const field = screen.getByLabelText('API token');

    expect(field).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
  });
});
`;
}

export function createStepper(): string {
  return `import './stepper.css';

export interface StepperProps {
  disabled?: boolean;
  max?: number;
  min?: number;
  onValueChange?: (value: number) => void;
  step?: number;
  value: number;
}

function clampValue(value: number, min?: number, max?: number) {
  if (typeof min === 'number' && value < min) {
    return min;
  }

  if (typeof max === 'number' && value > max) {
    return max;
  }

  return value;
}

export function Stepper({
  disabled = false,
  max,
  min,
  onValueChange,
  step = 1,
  value,
}: StepperProps) {
  function handleStep(direction: 1 | -1) {
    onValueChange?.(clampValue(value + direction * step, min, max));
  }

  return (
    <div className="axi-stepper">
      <button
        aria-label="Decrease value"
        className="axi-stepper__button"
        disabled={disabled}
        onClick={() => handleStep(-1)}
        type="button"
      >
        −
      </button>
      <output aria-live="polite" className="axi-stepper__value">
        {value}
      </output>
      <button
        aria-label="Increase value"
        className="axi-stepper__button"
        disabled={disabled}
        onClick={() => handleStep(1)}
        type="button"
      >
        +
      </button>
    </div>
  );
}
`;
}

export function createStepperStyles(): string {
  return `.axi-stepper {
  display: inline-grid;
  grid-template-columns: auto minmax(3rem, auto) auto;
  align-items: center;
  gap: var(--space-2);
}

.axi-stepper__button {
  width: 2.5rem;
  height: 2.5rem;
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  cursor: pointer;
  font: inherit;
  font-weight: var(--font-weight-semibold);
}

.axi-stepper__button:disabled {
  opacity: var(--interaction-disabled-opacity);
  cursor: not-allowed;
}

.axi-stepper__value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--theme-bg-elevated);
  color: var(--theme-text-primary);
}
`;
}

export function createStepperTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Stepper } from '@/shared/components/Stepper';

describe('Stepper', () => {
  it('clamps increments and decrements through the callback', () => {
    const handleValueChange = vi.fn();

    render(<Stepper max={3} min={1} onValueChange={handleValueChange} value={2} />);

    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease value' }));

    expect(handleValueChange).toHaveBeenNthCalledWith(1, 3);
    expect(handleValueChange).toHaveBeenNthCalledWith(2, 1);
  });
});
`;
}

export function createSegmentedControl(): string {
  return `import './segmented-control.css';

export interface SegmentedControlOption {
  disabled?: boolean;
  label: string;
  value: string;
}

export interface SegmentedControlProps {
  onValueChange?: (value: string) => void;
  options: SegmentedControlOption[];
  value: string;
}

export function SegmentedControl({
  onValueChange,
  options,
  value,
}: SegmentedControlProps) {
  return (
    <div aria-label="Segmented control" className="axi-segmented-control" role="tablist">
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            aria-selected={selected}
            className="axi-segmented-control__item"
            data-selected={selected ? 'true' : 'false'}
            disabled={option.disabled}
            key={option.value}
            onClick={() => onValueChange?.(option.value)}
            role="tab"
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

export function createSegmentedControlStyles(): string {
  return `.axi-segmented-control {
  display: inline-flex;
  gap: var(--space-1);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  background: var(--theme-bg-elevated);
}

.axi-segmented-control__item {
  min-height: 2.5rem;
  border: none;
  border-radius: var(--radius-md);
  padding: 0 var(--space-4);
  background: transparent;
  color: var(--theme-text-secondary);
  cursor: pointer;
  font: inherit;
  font-weight: var(--font-weight-medium);
}

.axi-segmented-control__item[data-selected='true'] {
  background: var(--theme-bg-surface);
  color: var(--color-accent-primary);
  box-shadow: var(--shadow-sm);
}

.axi-segmented-control__item:disabled {
  opacity: var(--interaction-disabled-opacity);
  cursor: not-allowed;
}
`;
}

export function createSegmentedControlTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from '@/shared/components/SegmentedControl';

describe('SegmentedControl', () => {
  it('marks the selected segment and emits changes', () => {
    const handleValueChange = vi.fn();

    render(
      <SegmentedControl
        onValueChange={handleValueChange}
        options={[
          { label: 'Grid', value: 'grid' },
          { label: 'List', value: 'list' },
        ]}
        value="grid"
      />,
    );

    expect(screen.getByRole('tab', { name: 'Grid' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'List' }));
    expect(handleValueChange).toHaveBeenCalledWith('list');
  });
});
`;
}
