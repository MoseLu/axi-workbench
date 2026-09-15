// Tests for the front-end lifecycle status type and normalizer.
// Loaded by `node --import ./scripts/test-loader.mjs --test scripts/*.test.mjs`.
//
// The test loader (scripts/test-loader.mjs) registers tsx so the
// import below is resolved against the actual TypeScript source.

import { test } from "node:test";
import assert from "node:assert/strict";

const {
  RESOURCE_LIFECYCLE_STATUSES,
  normalizeResourceStatus
} = await import("../src/features/axi-resources/axiResources.ts");

test("normalizeResourceStatus: passes through every known lifecycle status", () => {
  const known = [
    "registered",
    "path-found",
    "verified",
    "stale",
    "failed",
    "missing"
  ];
  for (const value of known) {
    assert.equal(normalizeResourceStatus(value), value);
  }
});

test("normalizeResourceStatus: covers the full RESOURCE_LIFECYCLE_STATUSES tuple", () => {
  assert.equal(RESOURCE_LIFECYCLE_STATUSES.length, 6);
  for (const value of RESOURCE_LIFECYCLE_STATUSES) {
    assert.equal(normalizeResourceStatus(value), value);
  }
});

test("normalizeResourceStatus: unknown string falls back to 'path-found' with a warning", () => {
  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (msg) => warnCalls.push(String(msg));
  try {
    assert.equal(normalizeResourceStatus("verified-by-magic"), "path-found");
    assert.equal(normalizeResourceStatus(""), "path-found");
    // Case-sensitive: the API must use the exact documented casing.
    assert.equal(normalizeResourceStatus("REGISTERED"), "path-found");
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnCalls.length, 3);
  for (const call of warnCalls) {
    assert.match(call, /Unknown ResourceLifecycleStatus/);
    assert.match(call, /normalizing to "path-found"/);
  }
});

test("normalizeResourceStatus: non-string values fall back to 'path-found' with a warning", () => {
  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (msg) => warnCalls.push(String(msg));
  try {
    assert.equal(normalizeResourceStatus(undefined), "path-found");
    assert.equal(normalizeResourceStatus(null), "path-found");
    assert.equal(normalizeResourceStatus(42), "path-found");
    assert.equal(normalizeResourceStatus({}), "path-found");
    assert.equal(normalizeResourceStatus([]), "path-found");
    assert.equal(normalizeResourceStatus(true), "path-found");
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnCalls.length, 6);
});

test("normalizeResourceStatus: known statuses do not emit warnings", () => {
  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (msg) => warnCalls.push(String(msg));
  try {
    for (const value of RESOURCE_LIFECYCLE_STATUSES) {
      normalizeResourceStatus(value);
    }
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnCalls.length, 0);
});

test("normalizeResourceStatus: a single unknown value produces exactly one warning", () => {
  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (msg) => warnCalls.push(String(msg));
  try {
    normalizeResourceStatus("bogus-state");
    normalizeResourceStatus("bogus-state");
  } finally {
    console.warn = originalWarn;
  }
  // The normalizer intentionally logs once per call so the caller sees
  // every API response that carried a bad value; do not silently dedupe.
  assert.equal(warnCalls.length, 2);
});
