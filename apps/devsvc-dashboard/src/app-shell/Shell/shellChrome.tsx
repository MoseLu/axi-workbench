import type { AxiDashboardAvatarConfig, AxiDashboardShellProps } from "@axi/shell";

import devsvcLogoUrl from "../../assets/devsvc-logo.svg";
import type { AppSettings } from "../../settings/useAppSettings";

/** Sidebar brand block for the host shell. */
export function makeShellBrand(title: string): AxiDashboardShellProps["brand"] {
  return {
    logo: <img className="brand-logo" src={devsvcLogoUrl} alt="" />,
    title
  };
}

/** Avatar dropdown config for the host shell topbar. */
export function makeShellAvatarConfig({
  avatarDataUrl,
  displayName,
  logoutLabel,
  onChange,
  onLogout,
  previewCloseLabel,
  previewLabel,
  previewTitle,
  profileLabel,
  uploadLabel
}: {
  avatarDataUrl?: string;
  displayName: string;
  logoutLabel: string;
  onChange: (file: File) => void;
  onLogout: () => void;
  previewCloseLabel: string;
  previewLabel: string;
  previewTitle: string;
  profileLabel: string;
  uploadLabel: string;
}): AxiDashboardAvatarConfig {
  return {
    avatar: <span>{displayName.slice(0, 1).toUpperCase()}</span>,
    description: "team@cool-js.com",
    imageSrc: avatarDataUrl,
    label: displayName,
    menuItems: [
      { iconName: "my", key: "profile", label: profileLabel },
      { iconName: "exit", key: "logout", label: logoutLabel, onClick: onLogout }
    ],
    name: displayName,
    onChange,
    previewCloseLabel,
    previewLabel,
    previewTitle,
    uploadLabel
  };
}

/** Host shell class list derived from the persisted layout preferences. */
export function makeShellClassName({
  isHostedPage,
  navigationMode,
  settings
}: {
  isHostedPage: boolean;
  navigationMode: "host" | "subapp";
  settings: AppSettings;
}) {
  return [
    "app-shell",
    `layout-${settings.menuLayout}`,
    `menu-style-${settings.menuStyle}`,
    `box-style-${settings.boxStyle}`,
    `container-${settings.containerWidth}`,
    isHostedPage ? `navigation-${navigationMode}` : "",
    settings.colorWeak ? "color-weak" : ""
  ].filter(Boolean).join(" ");
}
