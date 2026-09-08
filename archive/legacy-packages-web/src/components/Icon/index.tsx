import React from 'react';
import { iconPathMap } from '@/assets/icons';
import type { IconProps } from '@/assets/icons/types';

/**
 * Icon 组件 - SVG 图标包装器
 * 
 * 使用方式:
 * <Icon name="legacy-edit" size={20} />
 * <Icon name="status-success" color="#52c41a" />
 * <Icon name="system-settings" size={24} className="custom-class" />
 */
const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = 'currentColor',
  className = '',
  center = false,
  onClick,
}) => {
  const path = iconPathMap[name];

  if (!path) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  const style: React.CSSProperties = {
    display: 'inline-block',
    width: size,
    height: size,
    backgroundColor: color,
    maskImage: `url(${path})`,
    WebkitMaskImage: `url(${path})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
    flexShrink: 0,
    ...(center ? { alignSelf: 'center' } : {}),
  };

  return (
    <span
      style={style}
      className={className}
      onClick={onClick}
      role="img"
      aria-label={name}
    />
  );
};

export default Icon;
