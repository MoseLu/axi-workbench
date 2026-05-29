export function createSwitchStyles(): string {
  return `.axi-switch {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.axi-switch__label {
  color: var(--theme-text-primary);
  font-weight: var(--font-weight-medium);
}

.axi-switch__control {
  position: relative;
  width: 3.25rem;
  height: 1.875rem;
  border: none;
  border-radius: 999px;
  background: var(--theme-bg-active);
  cursor: pointer;
  transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
}

.axi-switch__control[data-checked='true'] {
  background: var(--color-accent-primary);
}

.axi-switch__control:disabled {
  opacity: var(--interaction-disabled-opacity);
  cursor: not-allowed;
}

.axi-switch__thumb {
  position: absolute;
  top: 0.1875rem;
  left: 0.1875rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background: var(--theme-bg-surface);
  box-shadow: var(--theme-shadow-sm);
  transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
}

.axi-switch__control[data-checked='true'] .axi-switch__thumb {
  transform: translateX(1.375rem);
}
`;
}

export function createSwitchTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from '@/shared/components/Switch';

describe('Switch', () => {
  it('renders checked state and emits changes', () => {
    const handleCheckedChange = vi.fn();

    render(<Switch checked={false} label="Notifications" onCheckedChange={handleCheckedChange} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Notifications' }));

    expect(screen.getByRole('switch', { name: 'Notifications' })).toHaveAttribute('aria-checked', 'false');
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });
});
`;
}

export function createChipInput(): string {
  return `import type { KeyboardEvent } from 'react';

import './chip-input.css';

export interface ChipInputProps {
  onAdd?: (value: string) => void;
  onRemove?: (value: string) => void;
  placeholder?: string;
  value?: string;
  values: string[];
}

export function ChipInput({
  onAdd,
  onRemove,
  placeholder = 'Add tag',
  value = '',
  values,
}: ChipInputProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const normalized = value.trim();

    if (normalized) {
      onAdd?.(normalized);
    }
  }

  return (
    <div className="axi-chip-input">
      <div className="axi-chip-input__chips">
        {values.map((chip) => (
          <span className="axi-chip-input__chip" key={chip}>
            <span>{chip}</span>
            <button
              aria-label={\`Remove \${chip}\`}
              className="axi-chip-input__remove"
              onClick={() => onRemove?.(chip)}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="axi-chip-input__field"
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}
`;
}

export function createChipInputStyles(): string {
  return `.axi-chip-input {
  display: grid;
  gap: var(--space-3);
}

.axi-chip-input__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.axi-chip-input__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border-radius: 999px;
  padding: var(--space-1) var(--space-3);
  background: var(--color-surface-tag);
  color: var(--color-accent-primary);
  font-size: var(--font-size-body-sm);
}

.axi-chip-input__remove {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: 1;
}

.axi-chip-input__field {
  width: 100%;
  min-height: var(--form-input-height, 2.75rem);
  border: var(--border-width-default) dashed var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  font: inherit;
}

.axi-chip-input__field:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}
`;
}

export function createChipInputTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChipInput } from '@/shared/components/ChipInput';

describe('ChipInput', () => {
  it('renders chips and emits add intents on enter', () => {
    const handleAdd = vi.fn();

    render(<ChipInput onAdd={handleAdd} value="release" values={['alpha']} />);

    fireEvent.keyDown(screen.getByPlaceholderText('Add tag'), { key: 'Enter' });

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(handleAdd).toHaveBeenCalledWith('release');
  });
});
`;
}

export function createDatePicker(): string {
  return `import type { InputHTMLAttributes } from 'react';

import './date-picker.css';

export interface DatePickerProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function DatePicker({
  className,
  invalid = false,
  type = 'date',
  ...props
}: DatePickerProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || props['aria-invalid'] === true ? 'true' : undefined}
      className={['axi-date-picker', invalid && 'axi-date-picker--invalid', className]
        .filter(Boolean)
        .join(' ')}
      type={type}
    />
  );
}
`;
}

export function createDatePickerStyles(): string {
  return `.axi-date-picker {
  width: 100%;
  min-height: var(--form-input-height, 2.75rem);
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  font: inherit;
}

.axi-date-picker:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.axi-date-picker--invalid {
  border-color: var(--color-danger-main);
}
`;
}

export function createDatePickerTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DatePicker } from '@/shared/components/DatePicker';

describe('DatePicker', () => {
  it('renders an accessible date input', () => {
    render(<DatePicker aria-label="Release date" invalid />);

    expect(screen.getByLabelText('Release date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Release date')).toHaveAttribute('aria-invalid', 'true');
  });
});
`;
}

export function createNumberField(): string {
  return `import type { InputHTMLAttributes } from 'react';

import './number-field.css';

export interface NumberFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function NumberField({
  className,
  invalid = false,
  type = 'number',
  ...props
}: NumberFieldProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || props['aria-invalid'] === true ? 'true' : undefined}
      className={['axi-number-field', invalid && 'axi-number-field--invalid', className]
        .filter(Boolean)
        .join(' ')}
      type={type}
    />
  );
}
`;
}

export function createNumberFieldStyles(): string {
  return `.axi-number-field {
  width: 100%;
  min-height: var(--form-input-height, 2.75rem);
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  font: inherit;
}

.axi-number-field:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.axi-number-field--invalid {
  border-color: var(--color-danger-main);
}
`;
}

export function createNumberFieldTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NumberField } from '@/shared/components/NumberField';

describe('NumberField', () => {
  it('renders a numeric input with step support', () => {
    render(<NumberField aria-label="Seats" min={1} step={1} />);

    expect(screen.getByLabelText('Seats')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Seats')).toHaveAttribute('step', '1');
  });
});
`;
}

export function createCombobox(): string {
  return `import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';

import './combobox.css';

export interface ComboboxOption {
  label: string;
  value: string;
}

export interface ComboboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'list'> {
  invalid?: boolean;
  listId?: string;
  options: ComboboxOption[];
}

export function Combobox({
  className,
  invalid = false,
  listId,
  options,
  ...props
}: ComboboxProps) {
  const generatedId = useId().replace(/:/g, '');
  const resolvedListId = listId ?? \`axi-combobox-\${generatedId}\`;

  return (
    <div className="axi-combobox">
      <input
        {...props}
        aria-invalid={invalid || props['aria-invalid'] === true ? 'true' : undefined}
        className={['axi-combobox__field', invalid && 'axi-combobox__field--invalid', className]
          .filter(Boolean)
          .join(' ')}
        list={resolvedListId}
      />
      <datalist id={resolvedListId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </div>
  );
}
`;
}

export function createComboboxStyles(): string {
  return `.axi-combobox {
  width: 100%;
}

.axi-combobox__field {
  width: 100%;
  min-height: var(--form-input-height, 2.75rem);
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  font: inherit;
}

.axi-combobox__field:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.axi-combobox__field--invalid {
  border-color: var(--color-danger-main);
}
`;
}

export function createComboboxTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Combobox } from '@/shared/components/Combobox';

describe('Combobox', () => {
  it('connects the input to a datalist of options', () => {
    render(
      <Combobox
        aria-label="Environment"
        options={[
          { label: 'Production', value: 'prod' },
          { label: 'Staging', value: 'staging' },
        ]}
      />,
    );

    const field = screen.getByLabelText('Environment');

    expect(field).toHaveAttribute('list');
    expect(screen.getByDisplayValue('prod')).toBeInTheDocument();
    expect(screen.getByDisplayValue('staging')).toBeInTheDocument();
  });
});
`;
}

export function createFileTrigger(): string {
  return `import type { ChangeEvent, InputHTMLAttributes } from 'react';
import { useId } from 'react';

import './file-trigger.css';

export interface FileTriggerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  buttonLabel: string;
  onFilesSelected?: (files: FileList | null) => void;
}

export function FileTrigger({
  buttonLabel,
  className,
  id,
  onFilesSelected,
  ...props
}: FileTriggerProps) {
  const generatedId = useId().replace(/:/g, '');
  const inputId = id ?? \`axi-file-trigger-\${generatedId}\`;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFilesSelected?.(event.currentTarget.files);
  }

  return (
    <div className={['axi-file-trigger', className].filter(Boolean).join(' ')}>
      <input
        {...props}
        className="axi-file-trigger__input"
        id={inputId}
        onChange={handleChange}
        type="file"
      />
      <label className="axi-file-trigger__button" htmlFor={inputId}>
        {buttonLabel}
      </label>
    </div>
  );
}
`;
}
