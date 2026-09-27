import { describe, expect, it } from "vitest";
import { redactEntry, redactString } from "./redactor";

describe("redactor", () => {
  it("accepts ordinary Chinese preference text", () => {
    const result = redactEntry({ summary: "默认横屏图片", facts: { preferredOrientation: "landscape" } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).toBe("默认横屏图片");
      expect(result.value.facts.preferredOrientation).toBe("landscape");
    }
  });

  it("rejects bearer tokens", () => {
    const result = redactEntry({ summary: "Authorization: Bearer abc.def.ghi" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("credential_header");
  });

  it("rejects absolute paths", () => {
    const result = redactEntry({ summary: "保存到 /Users/alice/file.txt" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("absolute_path");
  });

  it("rejects Windows drive paths", () => {
    const result = redactEntry({ summary: "see C:\\Users\\alice\\file" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("absolute_path");
  });

  it("rejects file URIs", () => {
    const result = redactEntry({ summary: "open file:///etc/passwd" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("absolute_path");
  });

  it("rejects JWT-shaped strings", () => {
    const result = redactEntry({ summary: "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("credential_header");
  });

  it("rejects PEM private keys", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----";
    const result = redactEntry({ summary: pem });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("credential_header");
  });

  it("rejects URLs with sig= query secrets", () => {
    const result = redactEntry({
      summary: "see https://example.com/x?signature=abcdef0123456789abcdef0123456789&token=xx",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("url_query_secret");
  });

  it("rejects data: URLs", () => {
    const result = redactEntry({
      summary: "preview data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("data_url");
  });

  it("rejects raw provider payload keys", () => {
    const result = redactEntry({
      summary: "raw",
      facts: { rawProviderPayload: "https://provider/x?token=abc" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.facts.rawProviderPayload).toBe("[REDACTED]");
  });

  it("rejects blocked sensitivity", () => {
    const result = redactEntry({ summary: "x", sensitivity: "blocked" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("blocked_sensitivity");
  });

  it("rejects cookies", () => {
    const result = redactEntry({ summary: "cookie: session=abc" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("secret_keyword");
  });

  it("redactString reports redacted state", () => {
    expect(redactString("横屏")).toEqual({ value: "横屏", redacted: false });
    expect(redactString("/etc/passwd").redacted).toBe(true);
  });
});
