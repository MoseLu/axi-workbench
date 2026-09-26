import { describe, expect, it } from "vitest";
import { SESSION_REDACTED_PLACEHOLDER, redactSessionText } from "./redactor";
import { projectResultSnapshot } from "./projection";

describe("projection|redact|payload|path", () => {
  it("keeps ordinary Chinese text", () => {
    expect(redactSessionText("帮我找一张山水图片").value).toBe("帮我找一张山水图片");
    expect(redactSessionText("帮我找一张山水图片").redacted).toBe(false);
  });

  it("replaces bearer tokens, JWTs and private keys with [已脱敏]", () => {
    const bearer = redactSessionText("Authorization: Bearer abcdefgh.ijklmnop.qrstuv");
    expect(bearer.value).toContain(SESSION_REDACTED_PLACEHOLDER);
    expect(bearer.redacted).toBe(true);

    const jwt = redactSessionText("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.abc");
    expect(jwt.value).toBe(SESSION_REDACTED_PLACEHOLDER);
  });

  it("strips absolute paths, file URIs and data URLs", () => {
    expect(redactSessionText("see /Users/mose/secret.png").value).toContain(SESSION_REDACTED_PLACEHOLDER);
    expect(redactSessionText("file:///tmp/hidden.png").value).toContain(SESSION_REDACTED_PLACEHOLDER);
    expect(redactSessionText("data:image/png;base64,AAAA").value).toContain(SESSION_REDACTED_PLACEHOLDER);
  });

  it("does not treat the word session as a secret", () => {
    expect(redactSessionText("继续今天的 session").redacted).toBe(false);
  });

  it("drops preview data URLs, provenance and extra facts from snapshots", () => {
    const snapshot = projectResultSnapshot({
      state: "presenting",
      explanation: "3 个结果已找到。",
      warnings: ["ok"],
      items: [{
        id: "img-1",
        kind: "image",
        title: "山水",
        preview: "data:image/png;base64,AAAA",
        facts: {
          path: "/Users/mose/secret.png",
          description: "风景参考",
          __rawProviderPayload: { bytes: "AAAA" },
        },
        provenance: { provider: "live:image-preview", ref: "file:///tmp/x" },
        safety: "safe",
      }],
    });
    const serialised = JSON.stringify(snapshot);
    expect(serialised).not.toContain("data:image");
    expect(serialised).not.toContain("/Users/mose");
    expect(serialised).not.toContain("live:image-preview");
    expect(serialised).not.toContain("__rawProviderPayload");
    expect(snapshot.items[0]?.title).toBe("山水");
    expect(snapshot.items[0]?.previewAvailable).toBe(true);
    expect(snapshot.items[0]?.description).toBe("风景参考");
    expect("preview" in snapshot.items[0]!).toBe(false);
  });
});
