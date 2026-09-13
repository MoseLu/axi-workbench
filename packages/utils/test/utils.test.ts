import { describe, expect, it } from "vitest"
import { cn, differenceInDays, formatDate, maskEmail, slugify, truncate } from "../src/index"

describe("@epap/utils", () => {
  it("merges conditional Tailwind classes with the last conflicting utility", () => {
    expect(cn("px-2", false && "text-red-500", "px-4", "font-medium")).toBe("px-4 font-medium")
  })

  it("formats dates and calculates calendar-day differences", () => {
    expect(formatDate("2026-09-13T12:34:56.000Z")).toBe("2026-09-13")
    expect(differenceInDays("2026-09-13", "2026-09-10")).toBe(3)
  })

  it("keeps string helpers deterministic for UI labels", () => {
    expect(slugify("  Axi Workbench / Admin  ")).toBe("axi-workbench-admin")
    expect(truncate("Axi Workbench", 8)).toBe("Axi W...")
    expect(maskEmail("owner@example.com")).toBe("ow***@example.com")
  })
})
