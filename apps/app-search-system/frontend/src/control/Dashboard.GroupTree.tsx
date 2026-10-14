/**
 * GroupTree —— 产线 / 设备树状菜单
 * 从原 Dashboard.tsx 中抽出,保持视图与原行为一致。
 */
import React, { useState } from 'react';
import { getDeviceStatusMeta, isDeviceConnected } from '../shared/deviceStatus';
import { IconChevron } from './Dashboard.utils';

interface GroupTreeProps {
  groups: string[];
  devices: Device[];
  deviceNames: Map<number, string>;
  selectedUuids: Set<string>;
  onToggle: (uuid: string) => void;
  onToggleGroup: (group: string) => void;
}

export default function GroupTree({
  groups,
  devices,
  deviceNames,
  selectedUuids,
  onToggle,
  onToggleGroup,
}: GroupTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (g: string) => setExpanded(e => ({ ...e, [g]: !e[g] }));

  const getGroupChecked = (group: string): boolean | null => {
    const devs = devices.filter(d => d.device_group === group);
    if (devs.length === 0) return false;
    const selected = devs.filter(d => selectedUuids.has(d.uuid));
    if (selected.length === 0) return false;
    if (selected.length === devs.length) return true;
    return null;
  };

  if (groups.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}
      >
        暂无产线
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {groups.map(group => {
        const devs = devices.filter(d => d.device_group === group);
        const checked = getGroupChecked(group);
        const isExpanded = expanded[group] !== false;
        const connectedCount = devs.filter(d => isDeviceConnected(d.status)).length;

        return (
          <div key={group}>
            {/* 父级行 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 12px',
                cursor: 'pointer',
                background: 'var(--bg-secondary)',
              }}
              onClick={() => toggleExpand(group)}
            >
              <IconChevron expanded={isExpanded} />
              <input
                type="checkbox"
                checked={checked === true}
                ref={el => {
                  if (el) el.indeterminate = checked === null;
                }}
                onChange={e => {
                  e.stopPropagation();
                  onToggleGroup(group);
                }}
                style={{ cursor: 'pointer', width: 15, height: 15, flexShrink: 0 }}
                onClick={e => e.stopPropagation()}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {group}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {connectedCount}/{devs.length}台
              </span>
            </div>

            {/* 子级列表 */}
            {isExpanded &&
              devs.map(d => {
                const isConnected = isDeviceConnected(d.status);
                const statusMeta = getDeviceStatusMeta(d.status);
                const isChecked = selectedUuids.has(d.uuid);
                return (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 12px 4px 32px',
                      background: isChecked ? 'var(--accent-light)' : 'transparent',
                      opacity: isConnected ? 1 : 0.5,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggle(d.uuid)}
                      style={{ cursor: 'pointer', width: 14, height: 14, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {deviceNames.get(d.id) || d.uuid.slice(0, 8)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: statusMeta.color,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
