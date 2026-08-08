import React from 'react';
import { Radio } from 'antd';
import { AxiTableGroup } from '@axi/crud';
import { useAxiTheme } from '@axi/core';
import { DesktopSettingsPage } from './DesktopSettingsPage';
import './Theme.css';

const modes = [
  { id: 'system', label: '跟随系统', desc: '与系统外观保持一致' },
  { id: 'light', label: '浅色', desc: '始终使用浅色界面' },
  { id: 'dark', label: '深色', desc: '始终使用深色界面' },
] as const;

const Theme: React.FC = () => {
  const { preference, setPreference } = useAxiTheme();
  const selected = modes.find((mode) => mode.id === preference) ?? modes[0];

  return (
    <DesktopSettingsPage activeKey="/admin/me/theme" title="主题外观">
      <AxiTableGroup title="显示偏好">
        <Radio.Group
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

export default Theme;
