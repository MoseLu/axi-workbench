import { describe, expect, it } from "vitest";
import { appNavGroups, appRouteKeys, filterNavGroups, getRouteKey, makeBreadcrumbItems, makeSearchItems } from "./appRegistry";

describe("Axi app registry", () => {
  it("declares the fixed product routes and sidebar groups", () => {
    expect(appRouteKeys).toEqual(["/overview", "/terminal", "/agent", "/providers", "/mobile", "/logs"]);
    expect(appNavGroups.map((group) => group.key)).toEqual(["workbench", "contracts", "diagnostics"]);
    expect(appNavGroups.flatMap((group) => group.children).map((item) => item.key)).toHaveLength(6);
  });

  it("normalizes paths, breadcrumbs, and global search metadata", () => {
    expect(getRouteKey("/mobile/details")).toBe("/mobile");
    expect(getRouteKey("/")).toBe("/overview");
    expect(makeBreadcrumbItems("/providers").map((item) => item.label)).toEqual(["合同与伴随端", "模型供应商"]);
    expect(makeSearchItems().find((item) => item.key === "/mobile")?.keywords).toContain("goal70");
  });

  it("filters sidebar groups by route labels and keywords", () => {
    expect(filterNavGroups("ollama").flatMap((group) => group.children).map((item) => item.key)).toEqual(["/providers"]);
    expect(filterNavGroups("agent").flatMap((group) => group.children).map((item) => item.key)).toEqual(["/agent"]);
  });
});
