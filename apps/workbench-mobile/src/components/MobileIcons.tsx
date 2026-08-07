import type { SVGProps } from 'react';

export type MobileIconName =
  | 'home'
  | 'projects'
  | 'focus'
  | 'inbox'
  | 'profile'
  | 'search'
  | 'bell'
  | 'arrow-right'
  | 'check'
  | 'moon'
  | 'sun'
  | 'language'
  | 'logout'
  | 'plus';

type MobileIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  name: MobileIconName;
  size?: number;
};

export function MobileIcon({ name, size = 22, strokeWidth = 1.8, ...props }: MobileIconProps) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<MobileIconName, React.ReactNode> = {
    home: <><path {...common} d="M3.5 10.8 12 3.8l8.5 7v8.4a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3z" /><path {...common} d="M9 20.5v-6h6v6" /></>,
    projects: <><path {...common} d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l1.7 2h8.8A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" /><path {...common} d="M3.5 10h17" /></>,
    focus: <><circle {...common} cx="12" cy="12" r="8.5" /><path {...common} d="m8.2 12.2 2.4 2.4 5.2-5.4" /></>,
    inbox: <><path {...common} d="M4 5.5h16v13H4z" /><path {...common} d="m4.4 6 7.6 6 7.6-6" /></>,
    profile: <><circle {...common} cx="12" cy="8.2" r="3.2" /><path {...common} d="M5.3 20.2c.9-3.5 3.4-5.4 6.7-5.4s5.8 1.9 6.7 5.4" /></>,
    search: <><circle {...common} cx="10.6" cy="10.6" r="5.8" /><path {...common} d="m15 15 4.2 4.2" /></>,
    bell: <><path {...common} d="M18 10.5c0-3.5-2.3-6-6-6s-6 2.5-6 6c0 5-2 5.8-2 6.8h16c0-1-2-1.8-2-6.8" /><path {...common} d="M9.5 20.2h5" /></>,
    'arrow-right': <path {...common} d="m9 5 7 7-7 7" />,
    check: <path {...common} d="m5.5 12.4 4.1 4.1 8.9-9" />,
    moon: <path {...common} d="M20 14.4A7.8 7.8 0 0 1 9.6 4 8 8 0 1 0 20 14.4Z" />,
    sun: <><circle {...common} cx="12" cy="12" r="3.5" /><path {...common} d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" /></>,
    language: <><circle {...common} cx="12" cy="12" r="8.5" /><path {...common} d="M3.8 12h16.4M12 3.5c2.1 2.4 3.1 5.2 3.1 8.5S14.1 18.1 12 20.5c-2.1-2.4-3.1-5.2-3.1-8.5S9.9 5.9 12 3.5Z" /></>,
    logout: <><path {...common} d="M10.5 4H5.8A1.8 1.8 0 0 0 4 5.8v12.4A1.8 1.8 0 0 0 5.8 20h4.7" /><path {...common} d="m14 8 4 4-4 4M18 12H9" /></>,
    plus: <path {...common} d="M12 5v14M5 12h14" />,
  };

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}

export function AxiMark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="axi-mobile-brand-mark">
      <path fill="#4285F4" d="M16 2.5 23.8 10.3 17 17.1 9.2 9.3z" />
      <path fill="#EA4335" d="m24.3 10.8 5.2 5.2-7.8 7.8-4.1-4.1z" />
      <path fill="#FBBC05" d="m16.5 17.6 4.7 4.7-5.2 5.2-7.8-7.8 4.1-4.1z" />
      <path fill="#34A853" d="m9.7 9.8 6.8 6.8-4.1 4.1L2.5 16z" />
    </svg>
  );
}
