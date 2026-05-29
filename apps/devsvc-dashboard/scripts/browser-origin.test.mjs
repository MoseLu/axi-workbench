import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLocalhostOrigin } from "../src/lib/browser.ts";

function withWindow(location, run) {
  const previousWindow = globalThis.window;
  globalThis.window = { location };
  try {
    run();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test("normalizeLocalhostOrigin ignores tauri protocol", () => {
  let replaced = false;
  withWindow({
    href: "tauri://localhost/",
    hostname: "localhost",
    protocol: "tauri:",
    replace() {
      replaced = true;
    }
  }, () => {
    assert.equal(normalizeLocalhostOrigin(), false);
  });
  assert.equal(replaced, false);
});

test("normalizeLocalhostOrigin redirects browser localhost to 127.0.0.1", () => {
  let nextHref = "";
  withWindow({
    href: "http://localhost:17889/",
    hostname: "localhost",
    protocol: "http:",
    replace(value) {
      nextHref = value;
    }
  }, () => {
    assert.equal(normalizeLocalhostOrigin(), true);
  });
  assert.equal(nextHref, "http://127.0.0.1:17889/");
});
