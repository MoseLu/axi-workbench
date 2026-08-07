import { AxiSvgIcon, type AxiSvgIconProps } from '@axi/core';
import {
  resolveAxiWorkbenchIcon,
  type AxiWorkbenchIconName,
} from '@axi/workbench-foundation/icons';

export type WorkbenchIconProps = Omit<AxiSvgIconProps, 'name'> & {
  name: AxiWorkbenchIconName;
};

/**
 * Web-only presentation adapter. The glyph and its semantic name are shared
 * with mobile, while Web owns compact admin-chrome sizing and button chrome.
 */
export function WorkbenchIcon({ name, ...props }: WorkbenchIconProps) {
  return <AxiSvgIcon {...props} name={resolveAxiWorkbenchIcon(name)} />;
}
