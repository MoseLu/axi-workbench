/**
 * Theme preference picker (system / light / dark).
 *
 * Lives in `me/_components/` so the page-level view (Theme.tsx) only
 * imports a same-directory component and stays free of 3-layer cross-layer
 * imports into i18n.
 */
import React from 'react';
import { AxiTableGroup } from '@axi/crud';
import { useAxiTheme } from '@axi/core';
import { AxiSelectButton } from '@axi/widgets';
import { useI18n } from '../../../../i18n';
import { DesktopSettingsPage } from '../DesktopSettingsPage';

type ModeId = 'system' | 'light' | 'dark';

export const ThemePicker: React.FC = () => {
  const { preference, setPreference } = useAxiTheme();
  const { t } = useI18n();
  const modes: Array<{ id: ModeId; label: string; desc: string }> = [
    { id: 'system', label: t('account.theme.mode.system'), desc: t('account.theme.mode.system.desc') },
    { id: 'light', label: t('account.theme.mode.light'), desc: t('account.theme.mode.light.desc') },
    { id: 'dark', label: t('account.theme.mode.dark'), desc: t('account.theme.mode.dark.desc') },
  ];
  const selected = modes.find((mode) => mode.id === preference) ?? modes[0];

  return (
    <DesktopSettingsPage activeKey="/admin/me/theme" title={t('account.theme.title')}>
      <AxiTableGroup title={t('account.theme.group')}>
        <AxiSelectButton
          buttonStyle="solid"
          optionType="button"
          options={modes.map((mode) => ({ label: mode.label, value: mode.id }))}
          value={preference}
          onChange={(event) => setPreference(event.target.value)}
        />
        <p className="wb-theme__description">{selected.desc}</p>
      </AxiTableGroup>
    </DesktopSettingsPage>
  );
};

export default ThemePicker;
