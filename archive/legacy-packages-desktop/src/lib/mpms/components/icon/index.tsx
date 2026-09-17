import React from 'react';
import './style.css';

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Icon component — uses mask-image to support currentColor inheritance.
 * Pass a `resolver` via IconProvider to map icon names to SVG paths.
 */
const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = 'currentColor',
  className = '',
  onClick,
}) => {
  const ctx = React.useContext(IconContext);
  const path = ctx.resolver(name);

  if (!path) {
    console.warn(`[MpmsIcon] Icon "${name}" not found`);
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
  };

  return (
    <span
      style={style}
      className={`mpms-icon ${className}`}
      onClick={onClick}
      role="img"
      aria-label={name}
    />
  );
};

/** Icon resolver context — allows consumers to provide their own icon path mapping */
interface IconContextValue {
  resolver: (name: string) => string;
}

const defaultResolver = (name: string) => {
  const parts = name.split('-');
  const category = parts[0];
  const iconName = parts.slice(1).join('-');
  return `/src/assets/icons/${category}/${iconName}.svg`;
};

export const IconContext = React.createContext<IconContextValue>({
  resolver: defaultResolver,
});

export interface IconProviderProps {
  resolver: (name: string) => string;
  children: React.ReactNode;
}

/** Wrap your app with IconProvider to customize icon path resolution */
export const IconProvider: React.FC<IconProviderProps> = ({ resolver, children }) => (
  <IconContext.Provider value={{ resolver }}>{children}</IconContext.Provider>
);

export default Icon;
