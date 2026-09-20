import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "@axi/gateway-contracts";
import { SessionDrawer } from "./SessionDrawer";

const summary = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: "ses_aaaaaaa1",
  projectId: "ai-resource-orchestration",
  dateKey: "2026-08-29",
  kind: "daily",
  status: "active",
  title: "找一张山水图片",
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T12:00:00.000Z",
  revision: 1,
  messageCount: 2,
  ...overrides,
});

describe("SessionDrawer", () => {
  it("stays closed until open", () => {
    render(
      <SessionDrawer
        open={false}
        dateKey="2026-08-29"
        sessions={[summary()]}
        activeSessionId={null}
        statusMessage={null}
        onClose={() => undefined}
        onCreate={() => undefined}
        onSelect={() => undefined}
        onRename={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(screen.queryByRole("dialog", { name: "会话" })).not.toBeInTheDocument();
  });

  it("groups sessions, highlights the active one, and confirms delete", () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <SessionDrawer
        open
        dateKey="2026-08-29"
        sessions={[
          summary(),
          summary({ id: "ses_bbbbbbbb", kind: "manual", title: "草稿", dateKey: "2026-08-28" }),
        ]}
        activeSessionId="ses_aaaaaaa1"
        statusMessage={null}
        onClose={onClose}
        onCreate={() => undefined}
        onSelect={onSelect}
        onRename={() => undefined}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByRole("dialog", { name: "会话" })).toBeInTheDocument();
    expect(screen.getByText("今天")).toBeInTheDocument();
    fireEvent.click(screen.getByText("草稿"));
    expect(onSelect).toHaveBeenCalledWith("ses_bbbbbbbb");
    fireEvent.click(screen.getByRole("button", { name: "删除 找一张山水图片" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    expect(onDelete).toHaveBeenCalledWith("ses_aaaaaaa1");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an empty state with a create action", () => {
    const onCreate = vi.fn();
    render(
      <SessionDrawer
        open
        dateKey="2026-08-29"
        sessions={[]}
        activeSessionId={null}
        statusMessage="暂时无法加载历史"
        onClose={() => undefined}
        onCreate={onCreate}
        onSelect={() => undefined}
        onRename={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(screen.getByText("还没有已保存的会话。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "开始新会话" }));
    expect(onCreate).toHaveBeenCalled();
  });
});
