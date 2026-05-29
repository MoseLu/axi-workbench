import { describe, expect, it } from "vitest";
import { assertAxiSuiteSnapshot, buildMockAxiSuiteSnapshot } from "./axiSuiteSnapshot";

describe("Axi Mobile companion model", () => {
  it("keeps deep links, Notify endpoints, and latest artifact paths visible without secrets", () => {
    const snapshot = buildMockAxiSuiteSnapshot();

    expect(snapshot.mobile).toMatchObject({
      owner: "axi-mobile",
      packageName: "com.mosscoder.notify",
      projectPath: "/Volumes/code/workspace/projects/axi-notify/android-app",
      latestGoal70Artifact: expect.stringContaining("goal70-20260525-093736"),
      deepLinks: expect.arrayContaining(["axi://chat", "axi://todo", "axi://workbench"]),
    });
    expect(snapshot.notify).toEqual({
      owner: "axi-notify",
      endpoints: ["POST /v1/events", "GET /v1/events"],
      authHeader: "X-Axi-Notify-Api-Key",
    });
    expect(() => assertAxiSuiteSnapshot(snapshot)).not.toThrow();
  });
});
