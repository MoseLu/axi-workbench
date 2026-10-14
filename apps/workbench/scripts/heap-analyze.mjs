#!/usr/bin/env node
// heap-analyze.mjs — placeholder stub (recreated 2026-10-14, see workbench HANDOFF).
//
// Originally created as part of the LCP/perf batch (c95a2f18) but was missing
// from the working tree. This stub reports basic V8 heap counters so that it
// stays executable, harmless, and self-documenting. Replace with the real
// analyzer when the audit-remediation branch is restored.

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`heap-analyze.mjs — placeholder heap analyzer

Usage:
  node apps/workbench/scripts/heap-analyze.mjs [--help]

This is a stub. It prints current V8 memoryUsage() counters and exits 0.
Owner should replace with the real analyzer (per-agent heap snapshot diff,
allocator breakdown, retained-object reachability, etc.).`);
  process.exit(0);
}

const heap = process.memoryUsage();
const mb = (b) => (b / 1024 / 1024).toFixed(2);
console.log('[stub] heap-analyze on Node', process.version);
console.log('  rss:        ', mb(heap.rss), 'MB');
console.log('  heapTotal:  ', mb(heap.heapTotal), 'MB');
console.log('  heapUsed:   ', mb(heap.heapUsed), 'MB');
console.log('  external:   ', mb(heap.external), 'MB');
console.log('  arrayBuffers:', mb(heap.arrayBuffers), 'MB');
process.exit(0);