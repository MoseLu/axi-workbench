import assert from "node:assert/strict";
import test from "node:test";

import { isIgnorableHostedWebviewCloseError } from "../src/features/hosted/hostedWebviews.ts";

test("hosted webview cleanup ignores missing or ACL-denied stale webviews", () => {
  assert.equal(isIgnorableHostedWebviewCloseError(new Error("webview not found")), true);
  assert.equal(
    isIgnorableHostedWebviewCloseError("Command plugin:webview|get_all_webviews not allowed by ACL"),
    true
  );
  assert.equal(isIgnorableHostedWebviewCloseError(new Error("failed to create webview")), false);
});
