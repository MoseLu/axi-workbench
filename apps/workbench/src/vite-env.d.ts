/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

/**
 * Ambient declaration for the icon components used by pages that import
 * from `@ant-design/icons` directly. The runtime package is provided as a
 * transitive dependency of `antd`, but its types are not hoisted into this
 * app's node_modules under the current pnpm setup. Rather than widen the
 * surface dependency list, we declare the specific icon components used
 * by pages and let the runtime resolution path through `antd` continue
 * to work. Keep this list in sync with the icon imports across `src/`.
 */
declare module '@ant-design/icons' {
  import type { ForwardRefExoticComponent, RefAttributes, HTMLAttributes } from 'react';

  export const CheckCircleOutlined: ForwardRefExoticComponent<
    RefAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & { spin?: boolean }
  >;
  export const CloseCircleOutlined: ForwardRefExoticComponent<
    RefAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & { spin?: boolean }
  >;
  export const ClockCircleOutlined: ForwardRefExoticComponent<
    RefAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & { spin?: boolean }
  >;
  export const CodeOutlined: ForwardRefExoticComponent<
    RefAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & { spin?: boolean }
  >;
  export const ExclamationCircleOutlined: ForwardRefExoticComponent<
    RefAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & { spin?: boolean }
  >;
  export const InfoCircleOutlined: ForwardRefExoticComponent<
    RefAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & { spin?: boolean }
  >;
  export const ReloadOutlined: ForwardRefExoticComponent<
    RefAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & { spin?: boolean }
  >;
  export const WarningOutlined: ForwardRefExoticComponent<
    RefAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & { spin?: boolean }
  >;
}
