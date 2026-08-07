import React from 'react';
import { WorkbenchIcon } from '../../../components/WorkbenchIcon';
import type { AxiWorkbenchIconName } from '@axi/workbench-foundation/icons';
import { MeGroup, MeNavRow, MeSubPage } from './MeSubChrome';

type Device = {
  name: string;
  meta: string;
  current: boolean;
  icon: AxiWorkbenchIconName;
};

const devices = [
  { name: '本机 · M2012K10C', meta: 'Android · 刚刚活跃', current: true, icon: 'mobile' },
  { name: 'MacBook Pro', meta: 'macOS · 2 小时前', current: false, icon: 'laptop' },
  { name: 'iPad mini', meta: 'iPadOS · 昨天', current: false, icon: 'tablet' },
] satisfies readonly Device[];

const Devices: React.FC = () => (
  <MeSubPage title="设备管理">
    <MeGroup>
      {devices.map((d, i) => (
        <div key={d.name} className={`wb-me-sub__device ${i < devices.length - 1 ? 'has-divider' : ''}`}>
          <WorkbenchIcon name={d.icon} className="wb-me-sub__device-icon" />
          <div className="wb-me-sub__device-meta">
            <div className="wb-me-sub__device-name">
              {d.name}
              {d.current ? <span className="wb-me-sub__device-tag">本机</span> : null}
            </div>
            <div className="wb-me-sub__device-sub">{d.meta}</div>
          </div>
          {!d.current ? (
            <button type="button" className="wb-me-sub__offline">
              下线
            </button>
          ) : null}
        </div>
      ))}
    </MeGroup>
    <MeGroup>
      <MeNavRow label="下线全部其他设备" onClick={() => undefined} />
    </MeGroup>
  </MeSubPage>
);

export default Devices;
