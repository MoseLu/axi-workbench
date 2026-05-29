export function createAvatar(): string {
  return `import './avatar.css';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  name: string;
  size?: AvatarSize;
  src?: string;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\\s+/)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, size = 'md', src }: AvatarProps) {
  return (
    <span aria-label={name} className={\`axi-avatar axi-avatar--\${size}\`}>
      {src ? <img alt={name} className="axi-avatar__image" src={src} /> : getInitials(name)}
    </span>
  );
}
`;
}

export function createAvatarStyles(): string {
  return `.axi-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--color-surface-spotlight);
  color: var(--color-accent-primary);
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
}

.axi-avatar--sm {
  width: 2rem;
  height: 2rem;
  font-size: var(--font-size-body-sm);
}

.axi-avatar--md {
  width: 2.75rem;
  height: 2.75rem;
  font-size: var(--font-size-body-md);
}

.axi-avatar--lg {
  width: 3.5rem;
  height: 3.5rem;
  font-size: var(--font-size-heading-sm);
}

.axi-avatar__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
`;
}

export function createAvatarTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from '@/shared/components/Avatar';

describe('Avatar', () => {
  it('falls back to initials when no image is provided', () => {
    render(<Avatar name="Axi Dashboard" />);

    expect(screen.getByLabelText('Axi Dashboard')).toHaveTextContent('AD');
  });
});
`;
}

export function createCommandPalette(): string {
  return `import './command-palette.css';

export interface CommandPaletteItem {
  description?: string;
  id: string;
  keywords?: string[];
  label: string;
}

export interface CommandPaletteProps {
  items: CommandPaletteItem[];
  onSelect?: (id: string) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  value?: string;
}

export function CommandPalette({
  items,
  onSelect,
  onValueChange,
  placeholder = 'Search commands',
  value = '',
}: CommandPaletteProps) {
  const normalized = value.trim().toLowerCase();
  const visibleItems = items.filter((item) => {
    if (!normalized) {
      return true;
    }

    const haystack = [item.label, item.description ?? '', ...(item.keywords ?? [])]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalized);
  });

  return (
    <section className="axi-command-palette">
      <input
        aria-label="Command palette"
        className="axi-command-palette__input"
        onChange={(event) => onValueChange?.(event.currentTarget.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      <ul className="axi-command-palette__list">
        {visibleItems.map((item) => (
          <li key={item.id}>
            <button
              className="axi-command-palette__item"
              onClick={() => onSelect?.(item.id)}
              type="button"
            >
              <span className="axi-command-palette__label">{item.label}</span>
              {item.description ? (
                <span className="axi-command-palette__description">{item.description}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
`;
}

export function createCommandPaletteStyles(): string {
  return `.axi-command-palette {
  display: grid;
  gap: var(--space-3);
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  background: var(--theme-bg-elevated);
}

.axi-command-palette__input {
  width: 100%;
  min-height: var(--form-input-height, 2.75rem);
  border: none;
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  background: var(--theme-bg-surface);
  color: var(--theme-text-primary);
  font: inherit;
}

.axi-command-palette__input:focus {
  outline: none;
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.axi-command-palette__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.axi-command-palette__item {
  display: grid;
  gap: var(--space-1);
  width: 100%;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3);
  background: transparent;
  color: var(--theme-text-primary);
  cursor: pointer;
  text-align: left;
}

.axi-command-palette__item:hover {
  background: var(--theme-bg-hover);
}

.axi-command-palette__description {
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
}
`;
}

export function createCommandPaletteTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CommandPalette } from '@/shared/components/CommandPalette';

describe('CommandPalette', () => {
  it('filters items and emits select events', () => {
    const handleSelect = vi.fn();

    render(
      <CommandPalette
        items={[
          { id: 'theme', label: 'Theme' },
          { id: 'tokens', label: 'Tokens' },
        ]}
        onSelect={handleSelect}
        value="tok"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tokens' }));

    expect(screen.queryByRole('button', { name: 'Theme' })).not.toBeInTheDocument();
    expect(handleSelect).toHaveBeenCalledWith('tokens');
  });
});
`;
}

export function createContextMenu(): string {
  return `import './context-menu.css';

export interface ContextMenuItem {
  disabled?: boolean;
  id: string;
  label: string;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  onSelect?: (id: string) => void;
  open: boolean;
  x?: number;
  y?: number;
}

export function ContextMenu({ items, onSelect, open, x = 0, y = 0 }: ContextMenuProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="axi-context-menu" style={{ left: x, top: y }}>
      <ul className="axi-context-menu__list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              className="axi-context-menu__item"
              disabled={item.disabled}
              onClick={() => onSelect?.(item.id)}
              type="button"
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
`;
}

export function createContextMenuStyles(): string {
  return `.axi-context-menu {
  position: absolute;
  min-width: 12rem;
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  background: var(--theme-bg-elevated);
  box-shadow: var(--shadow-popup);
}

.axi-context-menu__list {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.axi-context-menu__item {
  width: 100%;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  color: var(--theme-text-primary);
  cursor: pointer;
  text-align: left;
}

.axi-context-menu__item:hover {
  background: var(--theme-bg-hover);
}
`;
}

export function createContextMenuTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ContextMenu } from '@/shared/components/ContextMenu';

describe('ContextMenu', () => {
  it('renders open items and emits selection', () => {
    const handleSelect = vi.fn();

    render(<ContextMenu items={[{ id: 'open', label: 'Open' }]} onSelect={handleSelect} open />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(handleSelect).toHaveBeenCalledWith('open');
  });
});
`;
}

export function createDataTable(): string {
  return `import './data-table.css';

export interface DataTableColumn {
  key: string;
  label: string;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  rows: Array<Record<string, string | number | null>>;
}

export function DataTable({ columns, rows }: DataTableProps) {
  return (
    <div className="axi-data-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`;
}

export function createDataTableStyles(): string {
  return `.axi-data-table {
  overflow-x: auto;
  border: var(--border-width-default) solid var(--theme-border-main);
  border-radius: var(--radius-lg);
  background: var(--theme-bg-surface);
}

.axi-data-table table {
  width: 100%;
  border-collapse: collapse;
}

.axi-data-table th,
.axi-data-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border-width-default) solid var(--color-border-subtle);
  text-align: left;
}

.axi-data-table th {
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
  font-weight: var(--font-weight-semibold);
}
`;
}

export function createDataTableTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataTable } from '@/shared/components/DataTable';

describe('DataTable', () => {
  it('renders headers and row values', () => {
    render(
      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
        ]}
        rows={[{ name: 'Theme', status: 'Ready' }]}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Ready' })).toBeInTheDocument();
  });
});
`;
}

export function createDescriptionList(): string {
  return `import './description-list.css';

export interface DescriptionItem {
  description: string;
  label: string;
}

export interface DescriptionListProps {
  items: DescriptionItem[];
}

export function DescriptionList({ items }: DescriptionListProps) {
  return (
    <dl className="axi-description-list">
      {items.map((item) => (
        <div className="axi-description-list__row" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
`;
}

export function createDescriptionListStyles(): string {
  return `.axi-description-list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}

.axi-description-list__row {
  display: grid;
  gap: var(--space-1);
  padding-bottom: var(--space-3);
  border-bottom: var(--border-width-default) solid var(--color-border-subtle);
}

.axi-description-list__row dt {
  color: var(--theme-text-secondary);
  font-size: var(--font-size-body-sm);
  font-weight: var(--font-weight-semibold);
}

.axi-description-list__row dd {
  margin: 0;
  color: var(--theme-text-primary);
}
`;
}

export function createDescriptionListTest(): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DescriptionList } from '@/shared/components/DescriptionList';

describe('DescriptionList', () => {
  it('renders label and description pairs', () => {
    render(<DescriptionList items={[{ description: 'Private OSS', label: 'Storage' }]} />);

    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Private OSS')).toBeInTheDocument();
  });
});
`;
}
