import {
  AppstoreOutlined,
  ApiOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DockerOutlined,
  KeyOutlined,
  ProjectOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { AxiLogoMark, AxiTag, useAxiTheme } from "@axi/core";
import { AxiDashboardShell, type AxiDashboardNavGroup } from "@axi/shell";
import { Space } from "antd";
import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import type { FleetModel } from "../lib/fleet-types";

const navItems = [
  { key: "/dashboard", icon: <AppstoreOutlined />, label: "仪表盘" },
  { key: "/devices", icon: <CloudServerOutlined />, label: "服务器管理" },
  { key: "/services", icon: <ApiOutlined />, label: "服务管理" },
  { key: "/projects", icon: <ProjectOutlined />, label: "项目管理" },
  { key: "/credentials", icon: <KeyOutlined />, label: "凭证管理" },
] as const;

const avatarStorageKey = "fleet-console.avatar.data-url";

export function FleetShell({ model }: { model: FleetModel }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleMode } = useAxiTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const [sidebarKeyword, setSidebarKeyword] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState(() => window.localStorage.getItem(avatarStorageKey) || "");

  const selectedKey = navItems.find((item) => location.pathname.startsWith(item.key))?.key ?? "/dashboard";
  const selectedItem = navItems.find((item) => item.key === selectedKey) ?? navItems[0];
  const navGroups = useMemo<AxiDashboardNavGroup[]>(() => [
    {
      key: "operations",
      label: "运维工作台",
      icon: <AppstoreOutlined />,
      children: navItems.slice(0, 3).map((item) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
        title: item.label,
      })),
    },
    {
      key: "governance",
      label: "资产治理",
      icon: <SafetyCertificateOutlined />,
      children: navItems.slice(3).map((item) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
        title: item.label,
      })),
    },
  ], []);
  const filteredNavGroups = useMemo(() => {
    const keyword = sidebarKeyword.trim().toLowerCase();
    if (!keyword) return navGroups;
    return navGroups
      .map((group) => {
        const groupMatched = String(group.label).toLowerCase().includes(keyword);
        const children = group.children.filter((item) => groupMatched || String(item.label).toLowerCase().includes(keyword) || item.key.includes(keyword));
        return children.length ? { ...group, children } : null;
      })
      .filter(Boolean) as AxiDashboardNavGroup[];
  }, [navGroups, sidebarKeyword]);

  function handleAvatarChange(file: File) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const nextValue = typeof reader.result === "string" ? reader.result : "";
      setAvatarDataUrl(nextValue);
      if (nextValue) {
        window.localStorage.setItem(avatarStorageKey, nextValue);
      }
    });
    reader.readAsDataURL(file);
  }

  return (
    <AxiDashboardShell
      activeNavKey={selectedKey}
      activeTabKey={selectedKey}
      avatarConfig={{
        avatar: <span>OP</span>,
        description: `${model.data.network} inventory`,
        imageSrc: avatarDataUrl || undefined,
        label: "Axi Fleet Ops",
        menuItems: [
          { iconName: "my", key: "profile", label: "管理账号" },
          { iconName: "exit", key: "logout", label: "退出登录" },
        ],
        name: "管理员",
        onChange: handleAvatarChange,
        previewCloseLabel: "关闭头像预览",
        previewLabel: "预览头像",
        previewTitle: "头像预览",
        uploadLabel: "更换头像",
      }}
      brand={{
        logo: <AxiLogoMark />,
        title: "AXI FLEET",
        subtitle: `${model.data.network} inventory`,
      }}
      breadcrumbActions={(
        <Space size={8} wrap className="admin-header-actions">
          <AxiTag icon={<DatabaseOutlined />} type="blue">
            registry
          </AxiTag>
          <AxiTag icon={<DockerOutlined />} type="purple">
            fleet
          </AxiTag>
          <AxiTag icon={<SafetyCertificateOutlined />} type="green">
            {model.summary.coverage}% coverage
          </AxiTag>
        </Space>
      )}
      breadcrumbs={[
        { key: "fleet", label: "Axi Fleet Console" },
        { current: true, key: selectedKey, label: selectedItem.label, icon: selectedItem.icon },
      ]}
      className="fleet-dashboard-shell"
      contentClassName="admin-content"
      contentFullscreen={contentFullscreen}
      navGroups={filteredNavGroups}
      onBack={() => navigate(-1)}
      onFullscreenToggle={() => setContentFullscreen((current) => !current)}
      onHome={() => navigate("/dashboard")}
      onNavSelect={(key) => navigate(key)}
      onReload={() => window.location.reload()}
      onSidebarSearchChange={setSidebarKeyword}
      onSidebarToggle={() => setSidebarCollapsed((current) => !current)}
      onTabMenu={() => navigate("/dashboard")}
      onTabSelect={(key) => navigate(key)}
      pageProps={{ fluid: true }}
      sidebarCollapsed={sidebarCollapsed}
      sidebarSearchPlaceholder="搜索页面"
      sidebarSearchValue={sidebarKeyword}
      tabs={[{ key: selectedKey, label: selectedItem.label, pinned: selectedKey === "/dashboard" }]}
      topbarActions={{
        github: { disabled: true, iconName: "github", key: "github", label: "GitHub" },
        notice: { badge: model.summary.missingCredentials || undefined, badgeTone: "warning", iconName: "notice", key: "notice", label: "通知" },
        message: { badge: model.summary.serviceCount || undefined, badgeTone: "success", iconName: "msg", key: "message", label: "消息" },
        language: { iconName: "lang", key: "language", label: "语言" },
        theme: { iconName: "theme", key: "theme", label: "切换主题", onClick: (event) => toggleMode(event.currentTarget) },
        settings: { iconName: "theme", key: "settings", label: "设置", onClick: () => navigate("/credentials") },
      }}
    >
      <div className="fleet-admin-scope admin-shell">
        <Outlet context={model} />
      </div>
    </AxiDashboardShell>
  );
}
