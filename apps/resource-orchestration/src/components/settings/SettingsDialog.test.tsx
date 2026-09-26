import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThemeChoice } from "../../hooks/useTheme";
import { SettingsDialog, type SettingsSectionId } from "./SettingsDialog";

const noop = () => undefined;

const getDialog = () => screen.getByRole("dialog", { name: "设置" });
const sessionProps = {
  sessionDateKey: "2026-08-29",
  sessionItems: [],
  activeSessionId: null,
  sessionStatusMessage: null,
  onCreateSession: noop,
  onSelectSession: noop,
  onRenameSession: noop,
  onDeleteSession: noop,
};

describe("SettingsDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(
      <SettingsDialog
        open={false}
        activeSection="memory"
        onChangeSection={noop}
        onClose={noop}
        theme="dark"
        onThemeChange={noop}
        {...sessionProps}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a centered modal with shared Axi navigation", () => {
    render(
      <SettingsDialog
        open
        activeSection="memory"
        onChangeSection={noop}
        onClose={noop}
        theme="dark"
        onThemeChange={noop}
        {...sessionProps}
      />,
    );
    const dialog = getDialog();
    expect(dialog).toHaveClass("ant-modal");
    expect(dialog).not.toHaveClass("ant-drawer-section");
    expect(within(dialog).getByRole("heading", { name: "设置" })).toBeInTheDocument();
    const tabs = within(dialog).getByRole("group", { name: "设置分类" });
    expect(within(tabs).getByRole("button", { name: "记忆" })).toHaveClass("is-active");
    expect(within(tabs).getByRole("button", { name: "主题" })).not.toHaveClass("is-active");
  });

  it("marks the active navigation item with the shared segmented style", () => {
    render(
      <SettingsDialog
        open
        activeSection="theme"
        onChangeSection={noop}
        onClose={noop}
        theme="dark"
        onThemeChange={noop}
        {...sessionProps}
      />,
    );
    const tabs = within(getDialog()).getByRole("group", { name: "设置分类" });
    expect(within(tabs).getByRole("button", { name: "主题" })).toHaveClass("is-active");
    expect(within(tabs).getByRole("button", { name: "记忆" })).not.toHaveClass("is-active");
  });

  it("invokes onChangeSection when a navigation item is clicked", () => {
    const onChangeSection = vi.fn<(next: SettingsSectionId) => void>();
    render(
      <SettingsDialog
        open
        activeSection="memory"
        onChangeSection={onChangeSection}
        onClose={noop}
        theme="dark"
        onThemeChange={noop}
        {...sessionProps}
      />,
    );
    const tabs = within(getDialog()).getByRole("group", { name: "设置分类" });
    fireEvent.click(within(tabs).getByRole("button", { name: "主题" }));
    expect(onChangeSection).toHaveBeenCalledWith("theme");
  });

  it("invokes onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <SettingsDialog
        open
        activeSection="memory"
        onChangeSection={noop}
        onClose={onClose}
        theme="dark"
        onThemeChange={noop}
        {...sessionProps}
      />,
    );
    fireEvent.click(within(getDialog()).getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onThemeChange when a shared theme choice is selected", () => {
    const onThemeChange = vi.fn<(next: ThemeChoice) => void>();
    render(
      <SettingsDialog
        open
        activeSection="theme"
        onChangeSection={noop}
        onClose={noop}
        theme="dark"
        onThemeChange={onThemeChange}
        {...sessionProps}
      />,
    );
    fireEvent.click(within(getDialog()).getByRole("button", { name: "浅色" }));
    expect(onThemeChange).toHaveBeenCalledWith("light");
  });

  it("renders session history inside the settings modal panel", () => {
    render(
      <SettingsDialog
        open
        activeSection="session"
        onChangeSection={noop}
        onClose={noop}
        theme="dark"
        onThemeChange={noop}
        {...sessionProps}
      />,
    );
    const dialog = getDialog();
    expect(within(dialog).getByRole("region", { name: "会话" })).toBeInTheDocument();
    expect(within(dialog).getByText("还没有已保存的会话。")).toBeInTheDocument();
  });
});
