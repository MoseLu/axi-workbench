import { type ReactNode } from "react";
import { Breadcrumb } from "antd";

import type { AppBreadcrumbItem } from "../app-registry";
import type { AppSettings } from "../settings/useAppSettings";

export function AppBreadcrumbBar({ actions, breadcrumbs, settings }: { actions?: ReactNode; breadcrumbs: AppBreadcrumbItem[]; settings: AppSettings }) {
  if (!settings.breadcrumb) return null;

  return (
    <div className="app-breadcrumb-bar">
      <Breadcrumb
        className="app-breadcrumb"
        separator={<span className="app-breadcrumb-separator">|</span>}
        items={breadcrumbs.map((item) => ({
          key: item.key,
          title: (
            <span className={`app-breadcrumb-item ${item.current ? "is-current" : ""}`} aria-current={item.current ? "page" : undefined}>
              {item.icon ? <span className="app-breadcrumb-icon">{item.icon}</span> : null}
              <span className="app-breadcrumb-title">{item.title}</span>
            </span>
          )
        }))}
      />
      {actions ? <div className="app-breadcrumb-actions">{actions}</div> : null}
    </div>
  );
}
