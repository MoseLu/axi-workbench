#!/usr/bin/env node
// heap-snapshot.mjs — placeholder stub (recreated 2026-10-14, see workbench HANDOFF).
//
// Originally created as part of the LCP/perf batch (c95a2f18) but was missing
// from the working tree. This stub reports current V8 heap counters and would
// be the future home of a real snapshot emitter (write HeapSnapshot to .heapsnapshot).
// Stays executable and self-documenting until the real implementation lands.

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`heap-snapshot.mjs — placeholder heap snapshot

Usage:
  node apps/workbench/scripts/heap-snapshot.mjs [--help]

This is a stub. It prints current V8 memoryUsage() and would normally write a
.heapsnapshot via v8.writeHeapSnapshot() once the real implementation lands.`);
  process.exit(0);
}

const heap = process.memoryUsage();
const mb = (b) => (b / 1024 / 1024).toFixed(2);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
console.log('[stub] heap-snapshot on Node', process.version);
console.log('  heapUsed:  ', mb(heap.heapUsed), 'MB');
console.log('  heapTotal: ', mb(heap.heapTotal), 'MB');
console.log(`  would write: heap-${stamp}.heapsnapshot (stub, no file written)`);
process.exit(0);