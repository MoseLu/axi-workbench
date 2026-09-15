import type { HTMLAttributes } from 'react';
import { AxiSvgIcon } from '@axi/core';
import {
  resolveAxiWorkbenchIcon,
  type AxiWorkbenchIconName,
} from '@axi/workbench-foundation/icons';

export type MobileIconName =
  | 'home'
  | 'projects'
  | 'focus'
  | 'inbox'
  | 'profile'
  | 'search'
  | 'bell'
  | 'back'
  | 'arrow-right'
  | 'check'
  | 'moon'
  | 'sun'
  | 'language'
  | 'logout'
  | 'plus'
  | 'workspace'
  | 'scan';

type MobileIconProps = HTMLAttributes<HTMLSpanElement> & {
  name: MobileIconName;
  size?: number;
};

const mobileIconMap: Record<MobileIconName, AxiWorkbenchIconName> = {
  home: 'home',
  projects: 'project',
  focus: 'focus',
  inbox: 'message',
  profile: 'account',
  search: 'search',
  bell: 'notification',
  back: 'back',
  'arrow-right': 'forward',
  check: 'check',
  moon: 'moon',
  sun: 'sun',
  language: 'language',
  logout: 'logout',
  plus: 'add',
  workspace: 'workspace',
  scan: 'scan',
};

/** Mobile presentation adapter; the glyph source is shared with Web. */
export function MobileIcon({ name, size = 22, ...props }: MobileIconProps) {
  return <AxiSvgIcon {...props} name={resolveAxiWorkbenchIcon(mobileIconMap[name])} size={size} />;
}
