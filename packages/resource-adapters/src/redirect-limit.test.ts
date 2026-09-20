/**
 * packages/adapters/src/redirect-limit.test.ts — GHA-NEXT-033
 *
 * Verifies the redirect-follow limiter:
 *  - Caps hops at MAX_REDIRECTS (=3).
 *  - Re-checks every redirect target against the SSRF allowlist.
 *  - Switches to GET on 303; preserves method on 307/308.
 *  - Returns the final non-redirect response.
 *  - Throws typed errors so the gateway can map onto error codes.
 */

import { describe, expect, it } from "vitest";

import {
  MAX_REDIRECTS,
  RedirectLimitExceededError,
  RedirectSsrfRejectedError,
  fetchWithRedirectLimit,
} from "./redirect-limit";

const env = { GATEWAY_ALLOWLIST_HOSTS: "" };

const makeRedirect = (status: number, location: string): Response =>
  new Response(null, { status, headers: { location } });

const makeFinal = (body: string): Response =>
  new Response(body, { status: 200, headers: { "content-type": "text/plain" } });

describe("packages/adapters redirect-follow limiter — GHA-NEXT-033", () => {
  it("returns the final response when no redirect occurs", async () => {
    const transport = async () => makeFinal("hello");
    const response = await fetchWithRedirectLimit("http://127.0.0.1:9000/x", { env, transport });
    expect(await response.text()).toBe("hello");
  });

  it("follows a single 302 redirect to an allowlisted host", async () => {
    const transport = vi_sequence([
      { input: "http://127.0.0.1:9000/x", response: makeRedirect(302, "http://127.0.0.1:9001/y") },
      { input: "http://127.0.0.1:9001/y", response: makeFinal("done") },
    ]);
    const response = await fetchWithRedirectLimit("http://127.0.0.1:9000/x", { env, transport });
    expect(await response.text()).toBe("done");
  });

  it("throws RedirectSsrfRejectedError when a redirect targets a private IP", async () => {
    const transport = vi_sequence([
      { input: "http://127.0.0.1:9000/x", response: makeRedirect(302, "http://169.254.169.254/latest/meta-data") },
    ]);
    await expect(fetchWithRedirectLimit("http://127.0.0.1:9000/x", { env, transport }))
      .rejects.toBeInstanceOf(RedirectSsrfRejectedError);
  });

  it("throws RedirectSsrfRejectedError when a redirect targets RFC1918 space", async () => {
    const transport = vi_sequence([
      { input: "http://127.0.0.1:9000/x", response: makeRedirect(302, "http://10.0.0.5/admin") },
    ]);
    await expect(fetchWithRedirectLimit("http://127.0.0.1:9000/x", { env, transport }))
      .rejects.toBeInstanceOf(RedirectSsrfRejectedError);
  });

  it("throws RedirectSsrfRejectedError when a redirect uses a non-http(s) scheme", async () => {
    const transport = vi_sequence([
      { input: "http://127.0.0.1:9000/x", response: makeRedirect(302, "file:///etc/passwd") },
    ]);
    await expect(fetchWithRedirectLimit("http://127.0.0.1:9000/x", { env, transport }))
      .rejects.toBeInstanceOf(RedirectSsrfRejectedError);
  });

  it("throws RedirectLimitExceededError when MAX_REDIRECTS hops are exceeded", async () => {
    const infiniteRedirect = (status: number) => () => Promise.resolve(makeRedirect(status, "http://127.0.0.1:9000/next"));
    const transport = infiniteRedirect(302);
    await expect(fetchWithRedirectLimit("http://127.0.0.1:9000/x", { env, transport, maxRedirects: 3 }))
      .rejects.toBeInstanceOf(RedirectLimitExceededError);
  });

  it("follows up to MAX_REDIRECTS hops then rejects (allowlisted chain)", async () => {
    const transport = vi_sequence([
      { input: "http://127.0.0.1:9000/0", response: makeRedirect(302, "http://127.0.0.1:9000/1") },
      { input: "http://127.0.0.1:9000/1", response: makeRedirect(302, "http://127.0.0.1:9000/2") },
      { input: "http://127.0.0.1:9000/2", response: makeRedirect(302, "http://127.0.0.1:9000/3") },
      { input: "http://127.0.0.1:9000/3", response: makeRedirect(302, "http://127.0.0.1:9000/4") },
    ]);
    await expect(fetchWithRedirectLimit("http://127.0.0.1:9000/0", { env, transport, maxRedirects: MAX_REDIRECTS }))
      .rejects.toBeInstanceOf(RedirectLimitExceededError);
  });

  it("switches to GET on 303 (RFC 7231 §6.4.4)", async () => {
    let capturedMethod = "";
    const transport = vi_sequence([
      { input: "http://127.0.0.1:9000/x", response: makeRedirect(303, "http://127.0.0.1:9001/y") },
      {
        input: "http://127.0.0.1:9001/y",
        response: makeFinal("ok"),
        onCall: (call: { args: [string, RequestInit?] }) => {
          capturedMethod = String(call.args[1]?.method || "");
        },
      },
    ]);
    await fetchWithRedirectLimit("http://127.0.0.1:9000/x", { env, transport });
    expect(capturedMethod).toBe("GET");
  });

  it("preserves method on 307 redirects", async () => {
    let capturedMethod = "unset";
    const transport = vi_sequence([
      { input: "http://127.0.0.1:9000/x", response: makeRedirect(307, "http://127.0.0.1:9001/y") },
      {
        input: "http://127.0.0.1:9001/y",
        response: makeFinal("ok"),
        onCall: (call: { args: [string, RequestInit?] }) => {
          // When the test calls fetchWithRedirectLimit without an
          // explicit method, the helper preserves the empty init so
          // the transport's default (GET) applies. This is the
          // behavior we pin: 307/308 do NOT force a method switch.
          capturedMethod = String(call.args[1]?.method ?? "default");
        },
      },
    ]);
    await fetchWithRedirectLimit("http://127.0.0.1:9000/x", { env, transport });
    // 307 must not trigger the 303-style GET switch; the helper
    // forwards `currentInit` unchanged.
    expect(capturedMethod).not.toBe("GET");
    expect(capturedMethod).toBe("default");
  });

  it("rejects a non-allowlisted initial URL", async () => {
    const transport = async () => makeFinal("ignored");
    await expect(fetchWithRedirectLimit("http://169.254.169.254/", { env, transport }))
      .rejects.toBeInstanceOf(RedirectSsrfRejectedError);
  });

  it("accepts a custom allowlist via GATEWAY_ALLOWLIST_HOSTS", async () => {
    const transport = vi_sequence([
      { input: "http://provider.example/x", response: makeRedirect(302, "http://provider.example/y") },
      { input: "http://provider.example/y", response: makeFinal("ok") },
    ]);
    const response = await fetchWithRedirectLimit("http://provider.example/x", { env: { GATEWAY_ALLOWLIST_HOSTS: "provider.example" }, transport });
    expect(await response.text()).toBe("ok");
  });

  it("MAX_REDIRECTS is 3 per lane brief", () => {
    expect(MAX_REDIRECTS).toBe(3);
  });
});

/* --- Tiny test transport helpers --------------------------------------- */

type Step = {
  input: string;
  response: Response;
  onCall?: (call: { args: [string, RequestInit?] }) => void;
};

const vi_sequence = (steps: Step[]): ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) => {
  let i = 0;
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const step = steps[i];
    if (!step) throw new Error(`redirect-limit test: unexpected fetch #${i} at ${String(input)}`);
    const matched = String(input) === step.input || String(input).startsWith(step.input);
    if (!matched) throw new Error(`redirect-limit test: fetch #${i} expected ${step.input}, got ${String(input)}`);
    i += 1;
    step.onCall?.({ args: [String(input), init] });
    return step.response;
  };
};