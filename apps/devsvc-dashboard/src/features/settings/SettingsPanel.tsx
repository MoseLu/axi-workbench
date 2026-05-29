import { useState } from "react";
import { useTranslation } from "react-i18next";
import { InputNumber, Select } from "antd";
import { Check, Moon, Sun } from "lucide-react";

import layoutDualUrl from "../../assets/settings/layout-dual.png";
import layoutHorizontalUrl from "../../assets/settings/layout-horizontal.png";
import layoutMixedUrl from "../../assets/settings/layout-mixed.png";
import layoutVerticalUrl from "../../assets/settings/layout-vertical.png";
import menuDarkUrl from "../../assets/settings/menu-dark.png";
import menuDesignUrl from "../../assets/settings/menu-design.png";
import menuLightUrl from "../../assets/settings/menu-light.png";
import themeDarkUrl from "../../assets/settings/theme-dark.png";
import themeLightUrl from "../../assets/settings/theme-light.png";
import themeSystemUrl from "../../assets/settings/theme-system.png";
import { AxiSettingsChoice, AxiSettingsFieldRow, AxiSettingsPanel, AxiSettingsSection, AxiSettingsSegmented, AxiSettingsSwitchRow } from "@axi/settings";
import { AxiSvgIcon } from "@axi/core";
import { defaultSettings, menuLayoutOptions, type AppSettings, type BoxStyle, type ContainerWidth, type MenuLayout, type MenuStyle } from "../../settings/useAppSettings";
import { themePresets, type ThemeMode, type ThemeName, type ThemePreference, type ThemePreset } from "../../theme/tokens";

const themeStyleThumbnails: Record<ThemePreference, string> = {
  light: themeLightUrl,
  dark: themeDarkUrl,
  system: themeSystemUrl
};

const menuLayoutThumbnails: Record<MenuLayout, string> = {
  vertical: layoutVerticalUrl,
  horizontal: layoutHorizontalUrl,
  mixed: layoutMixedUrl,
  dual: layoutDualUrl
};

const menuStyleThumbnails: Record<MenuStyle, string> = {
  design: menuDesignUrl,
  dark: menuDarkUrl,
  light: menuLightUrl
};


export function ThemeModeTrigger({ mode, onModeToggle }: { mode: ThemeMode; onModeToggle: (trigger?: HTMLElement | null) => void }) {
  const { t } = useTranslation();
  const label = mode === "dark" ? t("切换亮色模式") : t("切换暗色模式");
  return (
    <button
      className="theme-trigger theme-mode-trigger"
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => onModeToggle(event.currentTarget)}
    >
      {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function SettingsPanel({
  open,
  preference,
  renderTrigger = true,
  settings,
  theme,
  onModeChange,
  onOpenChange,
  onSettingsChange,
  onThemeChange
}: {
  open?: boolean;
  preference: ThemePreference;
  renderTrigger?: boolean;
  settings: AppSettings;
  theme: ThemePreset;
  onModeChange: (mode: ThemePreference, trigger?: HTMLElement | null) => void;
  onOpenChange?: (open: boolean) => void;
  onSettingsChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onThemeChange: (name: ThemeName) => void;
}) {
  const { t } = useTranslation();
  const [internalDrawerOpen, setInternalDrawerOpen] = useState(false);
  const drawerOpen = open ?? internalDrawerOpen;
  const setDrawerOpen = onOpenChange ?? setInternalDrawerOpen;

  return (
    <>
      {renderTrigger ? (
        <button className="theme-trigger settings-trigger" type="button" aria-label={t("系统设置")} title={t("系统设置")} onClick={() => setDrawerOpen(true)}>
          <AxiSvgIcon name="set" size={16} animation="rotate" animationDuration={0.3} />
        </button>
      ) : null}
      <AxiSettingsPanel
        labels={{ title: t("系统设置") }}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      >
        <AxiSettingsSection title={t("主题风格")}>
          <div className="settings-card-grid theme-style-grid">
            {(["light", "dark", "system"] as ThemePreference[]).map((item) => (
              <AxiSettingsChoice
                active={preference === item}
                className={`theme-style-${item}`}
                key={item}
                label={{ light: t("浅色"), dark: t("深色"), system: t("系统") }[item]}
                onClick={() => onModeChange(item)}
              >
                <img alt="" src={themeStyleThumbnails[item]} />
              </AxiSettingsChoice>
            ))}
          </div>
        </AxiSettingsSection>

        <AxiSettingsSection title={t("菜单布局")}>
          <div className="settings-card-grid menu-layout-grid">
            {menuLayoutOptions.map((item) => (
              <AxiSettingsChoice
                active={settings.menuLayout === item.value}
                className={`layout-choice-${item.value}`}
                key={item.value}
                label={t(item.label)}
                onClick={() => onSettingsChange("menuLayout", item.value)}
              >
                <img alt="" src={menuLayoutThumbnails[item.value]} />
              </AxiSettingsChoice>
            ))}
          </div>
        </AxiSettingsSection>

        <AxiSettingsSection title={t("菜单风格")}>
          <div className="settings-card-grid menu-style-grid">
            {(["design", "dark", "light"] as MenuStyle[]).map((item) => (
              <AxiSettingsChoice
                active={settings.menuStyle === item}
                className={`menu-style-${item}`}
                key={item}
                label={{ design: t("设计"), dark: t("深色"), light: t("浅色") }[item]}
                onClick={() => onSettingsChange("menuStyle", item)}
              >
                <img alt="" src={menuStyleThumbnails[item]} />
              </AxiSettingsChoice>
            ))}
          </div>
        </AxiSettingsSection>

        <AxiSettingsSection title={t("系统主题色")}>
          <div className="settings-colors">
            {themePresets.map((item) => (
              <button
                className={`settings-color ${item.name === theme.name ? "is-active" : ""}`}
                style={{ backgroundColor: item.color }}
                key={item.name}
                type="button"
                title={t(item.label)}
                aria-label={t(item.label)}
                aria-pressed={item.name === theme.name}
                onClick={() => onThemeChange(item.name)}
              >
                {item.name === theme.name ? <Check size={13} /> : null}
              </button>
            ))}
          </div>
        </AxiSettingsSection>

        <AxiSettingsSection title={t("盒子样式")}>
          <AxiSettingsSegmented
            ariaLabel={t("盒子样式")}
            options={([
              { label: t("边框"), value: "border" },
              { label: t("阴影"), value: "shadow" }
            ] as Array<{ label: string; value: BoxStyle }>)}
            value={settings.boxStyle}
            onChange={(value) => onSettingsChange("boxStyle", value)}
          />
        </AxiSettingsSection>

        <AxiSettingsSection className="settings-container-width-section" title={t("容器宽度")}>
          <div className="settings-card-grid container-width-grid">
            {(["full", "fixed"] as ContainerWidth[]).map((item) => (
              <AxiSettingsChoice
                active={settings.containerWidth === item}
                key={item}
                label={{ full: t("铺满"), fixed: t("定宽") }[item]}
                media={false}
                onClick={() => onSettingsChange("containerWidth", item)}
              >
                <span className={`width-choice-icon width-choice-${item}`} aria-hidden="true" />
              </AxiSettingsChoice>
            ))}
          </div>
        </AxiSettingsSection>

        <AxiSettingsSection className="settings-foundation" title={t("基础配置")}>
          <AxiSettingsSwitchRow checked={settings.multiTab} label={t("开启多标签栏")} onChange={(checked) => onSettingsChange("multiTab", checked)} />
          <AxiSettingsSwitchRow checked={settings.accordion} label={t("侧边栏开启手风琴模式")} onChange={(checked) => onSettingsChange("accordion", checked)} />
          <AxiSettingsSwitchRow checked={settings.collapseButton} label={t("显示折叠侧边栏按钮")} onChange={(checked) => onSettingsChange("collapseButton", checked)} />
          <AxiSettingsSwitchRow checked={settings.quickEntry} label={t("显示快速入口")} onChange={(checked) => onSettingsChange("quickEntry", checked)} />
          <AxiSettingsSwitchRow checked={settings.reloadButton} label={t("显示重载页面按钮")} onChange={(checked) => onSettingsChange("reloadButton", checked)} />
          <AxiSettingsSwitchRow checked={settings.breadcrumb} label={t("显示全局面包屑导航")} onChange={(checked) => onSettingsChange("breadcrumb", checked)} />
          <AxiSettingsSwitchRow checked={settings.language} label={t("显示多语言选择")} onChange={(checked) => onSettingsChange("language", checked)} />
          <AxiSettingsSwitchRow checked={settings.progressBar} label={t("显示顶部进度条")} onChange={(checked) => onSettingsChange("progressBar", checked)} />
          <AxiSettingsSwitchRow checked={settings.colorWeak} label={t("色弱模式")} onChange={(checked) => onSettingsChange("colorWeak", checked)} />
          <AxiSettingsSwitchRow checked={settings.watermark} label={t("全局水印")} onChange={(checked) => onSettingsChange("watermark", checked)} />
          <AxiSettingsFieldRow label={t("菜单宽度")}>
            <InputNumber max={320} min={180} step={10} value={settings.menuWidth} onChange={(value) => onSettingsChange("menuWidth", Number(value) || defaultSettings.menuWidth)} />
          </AxiSettingsFieldRow>
          <AxiSettingsFieldRow label={t("标签页风格")}>
            <Select
              options={[{ label: t("默认"), value: "default" }, { label: t("卡片"), value: "card" }, { label: t("谷歌"), value: "google" }]}
              value={settings.tabStyle}
              onChange={(value) => onSettingsChange("tabStyle", value)}
            />
          </AxiSettingsFieldRow>
          <AxiSettingsFieldRow label={t("页面切换动画")}>
            <Select
              options={[
                { label: t("无动画"), value: "none" },
                { label: t("淡入淡出"), value: "fade" },
                { label: t("左侧滑入"), value: "slide-left" },
                { label: t("下方滑入"), value: "slide-bottom" },
                { label: t("上方滑入"), value: "slide-top" }
              ]}
              value={settings.pageTransition}
              onChange={(value) => onSettingsChange("pageTransition", value)}
            />
          </AxiSettingsFieldRow>
          <AxiSettingsFieldRow label={t("自定义圆角")}>
            <Select
              options={[0, 0.25, 0.5, 0.75, 1].map((value) => ({ label: String(value), value }))}
              value={settings.radius}
              onChange={(value) => onSettingsChange("radius", value)}
            />
          </AxiSettingsFieldRow>
        </AxiSettingsSection>
      </AxiSettingsPanel>
    </>
  );
}
