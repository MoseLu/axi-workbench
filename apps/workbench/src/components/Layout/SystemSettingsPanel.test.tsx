import { describe, expect, it } from 'vitest';
import { systemSettingsSections, systemSettingsTabs } from './SystemSettingsPanel';

describe('SystemSettingsPanel', () => {
  it('keeps the section and top-tab information architecture explicit', () => {
    expect(systemSettingsSections.map((section) => section.id)).toEqual([
      'general',
      'appearance',
      'account',
      'devices',
      'notifications',
      'shortcuts',
      'about',
    ]);
    expect(systemSettingsTabs.appearance.map((tab) => tab.id)).toEqual(['theme', 'layout']);
  });

  it('gives every section a dedicated top-level tab pair', () => {
    for (const section of systemSettingsSections) {
      expect(systemSettingsTabs[section.id]).toHaveLength(2);
      expect(systemSettingsTabs[section.id][0].descriptionZh).toBeTruthy();
      expect(systemSettingsTabs[section.id][1].descriptionEn).toBeTruthy();
    }
  });
});
