export function createTagPickerStyles(): string {
  return `.axi-tag-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.axi-tag-picker__tag {
  border: none;
  border-radius: 999px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-tag);
  color: var(--theme-text-secondary);
  cursor: pointer;
  font: inherit;
}

.axi-tag-picker__tag[data-selected='true'] {
  background: var(--color-accent-primary);
  color: var(--theme-text-inverse);
}
`;
}

export function createTagPickerTest(): string {
  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TagPicker } from '@/shared/components/TagPicker';

describe('TagPicker', () => {
  it('marks selected tags and emits toggles', () => {
    const handleToggle = vi.fn();

    render(
      <TagPicker
        onToggle={handleToggle}
        options={[
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' },
        ]}
        values={['public']}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Private' }));

    expect(screen.getByRole('button', { name: 'Public' })).toHaveAttribute('data-selected', 'true');
    expect(handleToggle).toHaveBeenCalledWith('private');
  });
});
`;
}

export function createUiComponentDoc(): string {
  return `# UI Components

This extension module seeds \`apps/web/src/shared/components\` with reusable product-facing primitives.

Current starters:

- \`Accordion\`
- \`Alert\`
- \`Avatar\`
- \`Breadcrumbs\`
- \`ChipInput\`
- \`Combobox\`
- \`CommandPalette\`
- \`ContextMenu\`
- \`DataTable\`
- \`DatePicker\`
- \`DescriptionList\`
- \`FileTrigger\`
- \`FormField\`
- \`InputField\`
- \`InlineActions\`
- \`NumberField\`
- \`Pagination\`
- \`PasswordField\`
- \`Skeleton\`
- \`Spinner\`
- \`Progress\`
- \`Modal\`
- \`Drawer\`
- \`Button\`
- \`DropdownMenu\`
- \`EmptySearchState\`
- \`SearchField\`
- \`SegmentedControl\`
- \`StatCard\`
- \`StatusDot\`
- \`Switch\`
- \`Stepper\`
- \`TagPicker\`
- \`Tabs\`
- \`TextareaField\`
- \`Topbar\`
- \`Toast\`
- \`Tooltip\`
- \`Badge\`
- \`Card\`
- \`EmptyState\`
- \`SectionCard\`
- \`ButtonLink\`

These are intentionally lightweight and token-driven so they can evolve into a larger component package later.
`;
}
