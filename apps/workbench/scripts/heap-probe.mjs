#!/usr/bin/env node
// heap-probe.mjs — placeholder stub (recreated 2026-10-14, see workbench HANDOFF).
//
// Originally created as part of the LCP/perf batch (c95a2f18) but was missing
// from the working tree. This stub prints current V8 heap counters and exits
// so that the script is executable and self-documenting. Replace with the real
// probe (sampling, time-series, per-agent JSONL sink) when restored.

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`heap-probe.mjs — placeholder heap probe

Usage:
  node apps/workbench/scripts/heap-probe.mjs [--help]

This is a stub. It prints a single V8 memoryUsage() sample and exits 0.
Owner should replace with the real probe (periodic sampling + delta report).`);
  process.exit(0);
}

const heap = process.memoryUsage();
const mb = (b) => (b / 1024 / 1024).toFixed(2);
const now = new Date().toISOString();
console.log(`[stub] heap-probe on Node ${process.version} @ ${now}`);
console.log('  heapUsed:', mb(heap.heapUsed), 'MB');
console.log('  heapTotal:', mb(heap.heapTotal), 'MB');
process.exit(0);