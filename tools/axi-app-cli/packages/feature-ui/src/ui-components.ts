import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import { defineScaffoldFeature } from '@axi/scaffold-kit';
import { createComponentsIndex, createSectionCard, createButtonLink, createAlert, createAlertStyles, createAlertTest, createBadge, createBadgeStyles, createBadgeTest, createCard, createCardStyles, createCardTest, createEmptyState, createEmptyStateStyles, createEmptyStateTest } from './ui-components/templates-01.js';
import { createButton, createModal, createModalStyles, createModalTest, createDrawer, createDrawerStyles, createDrawerTest, createProgress, createProgressStyles, createProgressTest, createSkeleton } from './ui-components/templates-02.js';
import { createSkeletonStyles, createSkeletonTest, createTabs, createTabsStyles, createTabsTest, createTooltip, createTooltipStyles, createTooltipTest, createFormField, createFormFieldStyles, createFormFieldTest } from './ui-components/templates-03.js';
import { createButtonStyles, createButtonTest, createTopbar, createTopbarStyles, createTopbarTest, createAccordion, createAccordionStyles, createAccordionTest } from './ui-components/templates-04.js';
import { createBreadcrumbs, createBreadcrumbsStyles, createBreadcrumbsTest, createPagination, createPaginationStyles, createPaginationTest, createToast, createToastStyles, createToastTest, createInputField, createInputFieldStyles, createInputFieldTest, createTextareaField, createTextareaFieldStyles, createTextareaFieldTest, createSwitch } from './ui-components/templates-05.js';
import { createSwitchStyles, createSwitchTest, createChipInput, createChipInputStyles, createChipInputTest, createDatePicker, createDatePickerStyles, createDatePickerTest, createNumberField, createNumberFieldStyles, createNumberFieldTest, createCombobox, createComboboxStyles, createComboboxTest, createFileTrigger } from './ui-components/templates-06.js';
import { createFileTriggerStyles, createFileTriggerTest, createSearchField, createSearchFieldStyles, createSearchFieldTest, createPasswordField, createPasswordFieldStyles, createPasswordFieldTest, createStepper, createStepperStyles, createStepperTest, createSegmentedControl, createSegmentedControlStyles, createSegmentedControlTest } from './ui-components/templates-07.js';
import { createAvatar, createAvatarStyles, createAvatarTest, createCommandPalette, createCommandPaletteStyles, createCommandPaletteTest, createContextMenu, createContextMenuStyles, createContextMenuTest, createDataTable, createDataTableStyles, createDataTableTest, createDescriptionList, createDescriptionListStyles, createDescriptionListTest } from './ui-components/templates-08.js';
import { createDropdownMenu, createDropdownMenuStyles, createDropdownMenuTest, createEmptySearchState, createEmptySearchStateStyles, createEmptySearchStateTest, createInlineActions, createInlineActionsStyles, createInlineActionsTest, createSpinner, createSpinnerStyles, createSpinnerTest, createStatCard, createStatCardStyles, createStatCardTest, createStatusDot, createStatusDotStyles, createStatusDotTest, createTagPicker } from './ui-components/templates-09.js';
import { createTagPickerStyles, createTagPickerTest, createUiComponentDoc } from './ui-components/templates-10.js';

export const uiComponentsManifest = {
  category: 'resources',
  configKey: 'modules.ui-components.enabled',
  dependencies: ['web-core', 'docs-core', 'theme-preset'],
  description: 'Starter shared components directory for reusable UI primitives.',
  enabledByDefault: false,
  id: 'ui-components',
  layer: 'extension',
  title: 'UI Components',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyUiComponents(_context: FeatureRenderContext): ProjectFile[] {
  return [
    { path: 'apps/web/src/shared/components/index.ts', content: createComponentsIndex() },
    { path: 'apps/web/src/shared/components/Accordion.tsx', content: createAccordion() },
    {
      path: 'apps/web/src/shared/components/accordion.css',
      content: createAccordionStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/Accordion.test.tsx',
      content: createAccordionTest(),
    },
    { path: 'apps/web/src/shared/components/Alert.tsx', content: createAlert() },
    { path: 'apps/web/src/shared/components/alert.css', content: createAlertStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Alert.test.tsx',
      content: createAlertTest(),
    },
    { path: 'apps/web/src/shared/components/Badge.tsx', content: createBadge() },
    { path: 'apps/web/src/shared/components/badge.css', content: createBadgeStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Badge.test.tsx',
      content: createBadgeTest(),
    },
    {
      path: 'apps/web/src/shared/components/Breadcrumbs.tsx',
      content: createBreadcrumbs(),
    },
    {
      path: 'apps/web/src/shared/components/breadcrumbs.css',
      content: createBreadcrumbsStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/Breadcrumbs.test.tsx',
      content: createBreadcrumbsTest(),
    },
    { path: 'apps/web/src/shared/components/Button.tsx', content: createButton() },
    { path: 'apps/web/src/shared/components/button.css', content: createButtonStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Button.test.tsx',
      content: createButtonTest(),
    },
    { path: 'apps/web/src/shared/components/Card.tsx', content: createCard() },
    { path: 'apps/web/src/shared/components/card.css', content: createCardStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Card.test.tsx',
      content: createCardTest(),
    },
    { path: 'apps/web/src/shared/components/Combobox.tsx', content: createCombobox() },
    {
      path: 'apps/web/src/shared/components/combobox.css',
      content: createComboboxStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/Combobox.test.tsx',
      content: createComboboxTest(),
    },
    {
      path: 'apps/web/src/shared/components/DatePicker.tsx',
      content: createDatePicker(),
    },
    {
      path: 'apps/web/src/shared/components/date-picker.css',
      content: createDatePickerStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/DatePicker.test.tsx',
      content: createDatePickerTest(),
    },
    { path: 'apps/web/src/shared/components/Drawer.tsx', content: createDrawer() },
    { path: 'apps/web/src/shared/components/drawer.css', content: createDrawerStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Drawer.test.tsx',
      content: createDrawerTest(),
    },
    { path: 'apps/web/src/shared/components/EmptyState.tsx', content: createEmptyState() },
    {
      path: 'apps/web/src/shared/components/empty-state.css',
      content: createEmptyStateStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/EmptyState.test.tsx',
      content: createEmptyStateTest(),
    },
    {
      path: 'apps/web/src/shared/components/FileTrigger.tsx',
      content: createFileTrigger(),
    },
    {
      path: 'apps/web/src/shared/components/file-trigger.css',
      content: createFileTriggerStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/FileTrigger.test.tsx',
      content: createFileTriggerTest(),
    },
    { path: 'apps/web/src/shared/components/Topbar.tsx', content: createTopbar() },
    { path: 'apps/web/src/shared/components/topbar.css', content: createTopbarStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Topbar.test.tsx',
      content: createTopbarTest(),
    },
    {
      path: 'apps/web/src/shared/components/SectionCard.tsx',
      content: createSectionCard(),
    },
    { path: 'apps/web/src/shared/components/FormField.tsx', content: createFormField() },
    {
      path: 'apps/web/src/shared/components/form-field.css',
      content: createFormFieldStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/FormField.test.tsx',
      content: createFormFieldTest(),
    },
    {
      path: 'apps/web/src/shared/components/InputField.tsx',
      content: createInputField(),
    },
    {
      path: 'apps/web/src/shared/components/input-field.css',
      content: createInputFieldStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/InputField.test.tsx',
      content: createInputFieldTest(),
    },
    { path: 'apps/web/src/shared/components/Modal.tsx', content: createModal() },
    { path: 'apps/web/src/shared/components/modal.css', content: createModalStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Modal.test.tsx',
      content: createModalTest(),
    },
    {
      path: 'apps/web/src/shared/components/NumberField.tsx',
      content: createNumberField(),
    },
    {
      path: 'apps/web/src/shared/components/number-field.css',
      content: createNumberFieldStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/NumberField.test.tsx',
      content: createNumberFieldTest(),
    },
    {
      path: 'apps/web/src/shared/components/Pagination.tsx',
      content: createPagination(),
    },
    {
      path: 'apps/web/src/shared/components/PasswordField.tsx',
      content: createPasswordField(),
    },
    {
      path: 'apps/web/src/shared/components/password-field.css',
      content: createPasswordFieldStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/PasswordField.test.tsx',
      content: createPasswordFieldTest(),
    },
    {
      path: 'apps/web/src/shared/components/pagination.css',
      content: createPaginationStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/Pagination.test.tsx',
      content: createPaginationTest(),
    },
    { path: 'apps/web/src/shared/components/Progress.tsx', content: createProgress() },
    {
      path: 'apps/web/src/shared/components/progress.css',
      content: createProgressStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/Progress.test.tsx',
      content: createProgressTest(),
    },
    { path: 'apps/web/src/shared/components/Skeleton.tsx', content: createSkeleton() },
    {
      path: 'apps/web/src/shared/components/SearchField.tsx',
      content: createSearchField(),
    },
    {
      path: 'apps/web/src/shared/components/search-field.css',
      content: createSearchFieldStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/SearchField.test.tsx',
      content: createSearchFieldTest(),
    },
    {
      path: 'apps/web/src/shared/components/SegmentedControl.tsx',
      content: createSegmentedControl(),
    },
    {
      path: 'apps/web/src/shared/components/segmented-control.css',
      content: createSegmentedControlStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/SegmentedControl.test.tsx',
      content: createSegmentedControlTest(),
    },
    {
      path: 'apps/web/src/shared/components/skeleton.css',
      content: createSkeletonStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/Skeleton.test.tsx',
      content: createSkeletonTest(),
    },
    { path: 'apps/web/src/shared/components/Tabs.tsx', content: createTabs() },
    { path: 'apps/web/src/shared/components/tabs.css', content: createTabsStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Tabs.test.tsx',
      content: createTabsTest(),
    },
    {
      path: 'apps/web/src/shared/components/TextareaField.tsx',
      content: createTextareaField(),
    },
    {
      path: 'apps/web/src/shared/components/textarea-field.css',
      content: createTextareaFieldStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/TextareaField.test.tsx',
      content: createTextareaFieldTest(),
    },
    { path: 'apps/web/src/shared/components/Toast.tsx', content: createToast() },
    { path: 'apps/web/src/shared/components/toast.css', content: createToastStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Toast.test.tsx',
      content: createToastTest(),
    },
    {
      path: 'apps/web/src/shared/components/ButtonLink.tsx',
      content: createButtonLink(),
    },
    { path: 'apps/web/src/shared/components/Avatar.tsx', content: createAvatar() },
    { path: 'apps/web/src/shared/components/avatar.css', content: createAvatarStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Avatar.test.tsx',
      content: createAvatarTest(),
    },
    {
      path: 'apps/web/src/shared/components/CommandPalette.tsx',
      content: createCommandPalette(),
    },
    {
      path: 'apps/web/src/shared/components/command-palette.css',
      content: createCommandPaletteStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/CommandPalette.test.tsx',
      content: createCommandPaletteTest(),
    },
    {
      path: 'apps/web/src/shared/components/ContextMenu.tsx',
      content: createContextMenu(),
    },
    {
      path: 'apps/web/src/shared/components/context-menu.css',
      content: createContextMenuStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/ContextMenu.test.tsx',
      content: createContextMenuTest(),
    },
    { path: 'apps/web/src/shared/components/DataTable.tsx', content: createDataTable() },
    {
      path: 'apps/web/src/shared/components/data-table.css',
      content: createDataTableStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/DataTable.test.tsx',
      content: createDataTableTest(),
    },
    {
      path: 'apps/web/src/shared/components/DescriptionList.tsx',
      content: createDescriptionList(),
    },
    {
      path: 'apps/web/src/shared/components/description-list.css',
      content: createDescriptionListStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/DescriptionList.test.tsx',
      content: createDescriptionListTest(),
    },
    {
      path: 'apps/web/src/shared/components/DropdownMenu.tsx',
      content: createDropdownMenu(),
    },
    {
      path: 'apps/web/src/shared/components/dropdown-menu.css',
      content: createDropdownMenuStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/DropdownMenu.test.tsx',
      content: createDropdownMenuTest(),
    },
    {
      path: 'apps/web/src/shared/components/EmptySearchState.tsx',
      content: createEmptySearchState(),
    },
    {
      path: 'apps/web/src/shared/components/empty-search-state.css',
      content: createEmptySearchStateStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/EmptySearchState.test.tsx',
      content: createEmptySearchStateTest(),
    },
    {
      path: 'apps/web/src/shared/components/InlineActions.tsx',
      content: createInlineActions(),
    },
    {
      path: 'apps/web/src/shared/components/inline-actions.css',
      content: createInlineActionsStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/InlineActions.test.tsx',
      content: createInlineActionsTest(),
    },
    { path: 'apps/web/src/shared/components/Spinner.tsx', content: createSpinner() },
    { path: 'apps/web/src/shared/components/spinner.css', content: createSpinnerStyles() },
    {
      path: 'apps/web/src/shared/components/__tests__/Spinner.test.tsx',
      content: createSpinnerTest(),
    },
    { path: 'apps/web/src/shared/components/StatCard.tsx', content: createStatCard() },
    {
      path: 'apps/web/src/shared/components/stat-card.css',
      content: createStatCardStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/StatCard.test.tsx',
      content: createStatCardTest(),
    },
    { path: 'apps/web/src/shared/components/StatusDot.tsx', content: createStatusDot() },
    {
      path: 'apps/web/src/shared/components/status-dot.css',
      content: createStatusDotStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/StatusDot.test.tsx',
      content: createStatusDotTest(),
    },
    { path: 'apps/web/src/shared/components/TagPicker.tsx', content: createTagPicker() },
    {
      path: 'apps/web/src/shared/components/tag-picker.css',
      content: createTagPickerStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/TagPicker.test.tsx',
      content: createTagPickerTest(),
    },
    { path: 'docs/modules/ui-components.md', content: createUiComponentDoc() },
    { path: 'apps/web/src/shared/components/Tooltip.tsx', content: createTooltip() },
    {
      path: 'apps/web/src/shared/components/tooltip.css',
      content: createTooltipStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/Tooltip.test.tsx',
      content: createTooltipTest(),
    },
    { path: 'apps/web/src/shared/components/Switch.tsx', content: createSwitch() },
    {
      path: 'apps/web/src/shared/components/switch.css',
      content: createSwitchStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/Switch.test.tsx',
      content: createSwitchTest(),
    },
    { path: 'apps/web/src/shared/components/Stepper.tsx', content: createStepper() },
    {
      path: 'apps/web/src/shared/components/stepper.css',
      content: createStepperStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/Stepper.test.tsx',
      content: createStepperTest(),
    },
    {
      path: 'apps/web/src/shared/components/ChipInput.tsx',
      content: createChipInput(),
    },
    {
      path: 'apps/web/src/shared/components/chip-input.css',
      content: createChipInputStyles(),
    },
    {
      path: 'apps/web/src/shared/components/__tests__/ChipInput.test.tsx',
      content: createChipInputTest(),
    },
  ];
}

export const uiComponentsFeature = defineScaffoldFeature(uiComponentsManifest, applyUiComponents);
