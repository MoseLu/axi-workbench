import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Planner } from "@axi/resource-orchestrator/browser";
import { runPlanner } from "../gateway-client";
import { useRunSession, type SessionRuntimeAdapter } from "./useRunSession";

vi.mock("../gateway-client", () => ({
  runPlanner: vi.fn(),
}));

const runPlannerMock = vi.mocked(runPlanner);

const planner: Planner = {
  id: "test-planner",
  plan: vi.fn(),
};

const adapter = (
  overrides: Partial<SessionRuntimeAdapter> = {},
): SessionRuntimeAdapter => ({
  status: "ready",
  dateKey: "2026-08-29",
  activeSessionId: "ses_test0001",
  snapshot: null,
  persistUserEntry: vi.fn().mockResolvedValue({ sessionId: "ses_test0001", ok: true }),
  persistOutcome: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe("useRunSession session persistence", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("awaits the user entry before dispatching the planner", async () => {
    let resolvePersist: ((value: { sessionId: string; ok: boolean }) => void) | undefined;
    const persistUserEntry = vi.fn(
      () => new Promise<{ sessionId: string; ok: boolean }>((resolve) => {
        resolvePersist = resolve;
      }),
    );
    runPlannerMock.mockResolvedValue({
      runId: "run-1",
      requestKey: "req-1",
      state: "clarifying",
      planner: "test-planner",
      items: [],
      warnings: [],
      trace: [],
      explanation: "请补充一点描述。",
    });
    const { result } = renderHook(() => useRunSession(planner, {
      session: adapter({ persistUserEntry }),
    }));

    await act(async () => {
      void result.current.submit("帮我找一张山水图片");
    });
    expect(persistUserEntry).toHaveBeenCalledTimes(1);
    expect(runPlannerMock).not.toHaveBeenCalled();

    await act(async () => {
      resolvePersist?.({ sessionId: "ses_test0001", ok: true });
    });
    await waitFor(() => expect(runPlannerMock).toHaveBeenCalledTimes(1));
    expect(runPlannerMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      persistUserEntry.mock.invocationCallOrder[0],
    );
  });

  it("still dispatches when user persistence fails", async () => {
    const persistUserEntry = vi.fn().mockResolvedValue({ sessionId: null, ok: false });
    runPlannerMock.mockResolvedValue({
      runId: "run-2",
      requestKey: "req-2",
      state: "clarifying",
      planner: "test-planner",
      items: [],
      warnings: [],
      trace: [],
    });
    const { result } = renderHook(() => useRunSession(planner, {
      session: adapter({ persistUserEntry }),
    }));

    await act(async () => {
      await result.current.submit("帮我找一张山水图片");
    });
    expect(runPlannerMock).toHaveBeenCalledTimes(1);
  });

  it("persists an interrupted outcome on pagehide with keepalive", async () => {
    const persistOutcome = vi.fn().mockResolvedValue(true);
    runPlannerMock.mockImplementation(() => new Promise(() => undefined));
    const { result } = renderHook(() => useRunSession(planner, {
      session: adapter({ persistOutcome }),
    }));

    await act(async () => {
      void result.current.submit("帮我找一张山水图片");
    });
    await waitFor(() => expect(runPlannerMock).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(persistOutcome).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "interrupted",
      keepalive: true,
      text: "上次回复未完成。",
    }));
  });
});
