import React from 'react';
import { LaptopOutlined, MobileOutlined, TabletOutlined } from '@ant-design/icons';
import { MeGroup, MeNavRow, MeSubPage } from './MeSubChrome';

const devices = [
  { name: '本机 · M2012K10C', meta: 'Android · 刚刚活跃', current: true, Icon: MobileOutlined },
  { name: 'MacBook Pro', meta: 'macOS · 2 小时前', current: false, Icon: LaptopOutlined },
  { name: 'iPad mini', meta: 'iPadOS · 昨天', current: false, Icon: TabletOutlined },
];

const Devices: React.FC = () => (
  <MeSubPage title="设备管理">
    <MeGroup>
      {devices.map((d, i) => (
        <div key={d.name} className={`wb-me-sub__device ${i < devices.length - 1 ? 'has-divider' : ''}`}>
          <d.Icon className="wb-me-sub__device-icon" />
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
