import React from 'react';
import { useAxiTheme } from '@axi/core';
import { WorkbenchIcon } from '../../../components/WorkbenchIcon';
import { MeGroup, MeSubPage } from './MeSubChrome';

const modes = [
  { id: 'system', label: '跟随系统', desc: '与设备外观保持一致', bg: 'var(--axi-bg-page)' },
  { id: 'light', label: '浅色', desc: '始终使用浅色界面', bg: 'var(--axi-bg-surface)' },
  { id: 'dark', label: '深色', desc: '始终使用深色界面', bg: 'var(--axi-bg-page)' },
] as const;

const Theme: React.FC = () => {
  const { preference, setPreference } = useAxiTheme();

  return (
    <MeSubPage title="主题外观">
      <MeGroup>
        {modes.map((m, i) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={preference === m.id}
            className={`wb-me-sub__theme ${i < modes.length - 1 ? 'has-divider' : ''}`}
            onClick={() => setPreference(m.id)}
          >
            <span className="wb-me-sub__theme-dot" style={{ background: m.bg }} />
            <span className="wb-me-sub__theme-meta">
              <div className="wb-me-sub__theme-title">{m.label}</div>
              <div className="wb-me-sub__theme-desc">{m.desc}</div>
            </span>
            {preference === m.id ? <WorkbenchIcon name="check" className="wb-me-sub__check" /> : null}
          </button>
        ))}
      </MeGroup>
    </MeSubPage>
  );
};

export default Theme;
