#!/usr/bin/env bash
#
# scripts/gateway-ha/rolling-restart.sh
#
# Executable end-to-end loopback rolling-restart drill. Mirrors
# docs/runbooks/gateway-rolling-restart.md step-by-step using the
# two-instance profile at scripts/gateway-ha/profiles/.
#
# Steps:
#   1. Baseline /health/ready on A=18977 and B=18988 (expect 200/200).
#   2. Drain A. If GATEWAY_ADMIN_TOKEN is set, POST /admin/drain;
#      otherwise SIGTERM A directly (runbook § admin-token-disabled).
#      Expect A /health/ready=503 and B /health/ready=200.
#   3. Wait for A to exit.
#   4. Spawn a replacement A; wait for /health/ready=200.
#   5. Drive 20 RPS for 10 seconds against A and B; snapshot /metrics.
#   6. Summarise per-instance downtime and the global elapsed.
#
# Exit codes: 0 on full success; non-zero + step name on first failure.
#
# Usage:
#   scripts/gateway-ha/rolling-restart.sh
#   scripts/gateway-ha/rolling-restart.sh --port-a 18787 --port-b 18887
#   ADMIN_TOKEN=secret scripts/gateway-ha/rolling-restart.sh
#   ROLLING_RESTART_LOG=... scripts/gateway-ha/rolling-restart.sh

set -euo pipefail

# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"
TESTS_DIR="${REPO_ROOT}/scripts/gateway-ha"
PROFILE="${TESTS_DIR}/profiles/two-instance-profile.mjs"

# Default ports chosen to avoid colliding with the lane-verification harness
# (8787 / 8788) and the soak test (other ports).
PORT_A=18977
PORT_B=18988
RPS=20
LOAD_DURATION_S=10
LOG_FILE="${ROLLING_RESTART_LOG:-/tmp/gateway-ha-evidence/rolling-restart.log}"

EVIDENCE_DIR="/tmp/gateway-ha-evidence"
mkdir -p "${EVIDENCE_DIR}"

usage() {
  cat <<EOF
Usage: $(basename "${BASH_SOURCE[0]}") [--port-a <n>] [--port-b <n>] [--rps <n>] [--duration <s>] [--log-file <path>]
EOF
}

while [[ $# -gt 0 ]]; do
  arg="${1}"
  case "${arg}" in
    --port-a) PORT_A="${2:?}"; shift 2 ;;
    --port-b) PORT_B="${2:?}"; shift 2 ;;
    --rps) RPS="${2:?}"; shift 2 ;;
    --duration) LOAD_DURATION_S="${2:?}"; shift 2 ;;
    --log-file) LOG_FILE="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; echo "unknown argument: ${arg}" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# Transcript — tee to stdout + log file. Everything printf goes here.
# ---------------------------------------------------------------------------

LOG_DIR="$(dirname "${LOG_FILE}")"
mkdir -p "${LOG_DIR}"
exec > >(tee -a "${LOG_FILE}") 2>&1

# date +%s%3N on darwin emits a trailing literal "N" suffix; strip it.
ts() { date +%s%3N | sed 's/N$//'; }
say() { printf '%s [rolling-restart] %s\n' "$(ts)" "${*}"; }

# Step bookkeeping — exposed so we can tag the final summary on failure.
STEP_NUM=0
FAIL_STEP=""
step() {
  STEP_NUM=$((STEP_NUM + 1))
  FAIL_STEP="${1}"
  say "--- step ${STEP_NUM}/6 BEGIN: ${FAIL_STEP} ---"
}
step_ok() {
  say "--- step ${STEP_NUM}/6 END: ok ---"
}
step_fail() {
  say "--- step ${STEP_NUM}/6 FAIL: ${1} ---"
  exit 1
}

# ---------------------------------------------------------------------------
# Cleanup — fires on EXIT (success or failure) so we never leak processes.
# ---------------------------------------------------------------------------

PROFILE_PID=""
PROFILE_A_PID=""
PROFILE_B_PID=""
REPLACEMENT_A_PID=""
CLEANED=0

cleanup() {
  if [[ "${CLEANED}" -eq 1 ]]; then return; fi
  CLEANED=1
  say "cleanup: killing replacement A pid=${REPLACEMENT_A_PID:-<none>} profile pid=${PROFILE_PID:-<none>}"
  if [[ -n "${REPLACEMENT_A_PID}" ]]; then
    kill -TERM "${REPLACEMENT_A_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${PROFILE_PID}" ]]; then
    kill -TERM "${PROFILE_PID}" >/dev/null 2>&1 || true
  fi
  # Wait a moment, then escalate.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.2
    alive=0
    [[ -n "${REPLACEMENT_A_PID}" ]] && kill -0 "${REPLACEMENT_A_PID}" >/dev/null 2>&1 && alive=1
    [[ -n "${PROFILE_PID}" ]] && kill -0 "${PROFILE_PID}" >/dev/null 2>&1 && alive=1
    [[ "${alive}" -eq 0 ]] && break
  done
  [[ -n "${REPLACEMENT_A_PID}" ]] && kill -KILL "${REPLACEMENT_A_PID}" >/dev/null 2>&1 || true
  [[ -n "${PROFILE_PID}" ]] && kill -KILL "${PROFILE_PID}" >/dev/null 2>&1 || true
  # Belt-and-braces — vitest may have left workers behind.
  pkill -KILL -f "vitest.*gateway-server-fixture" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

probe_status() {
  local out
  out="$(curl -sS -o /dev/null -w "%{http_code}" --max-time "${3:-3}" \
    "http://127.0.0.1:${1}${2}" 2>/dev/null)"
  printf '%s' "${out:-000}"
}

probe_body() {
  curl -sS --max-time "${3:-3}" "http://127.0.0.1:${1}${2}" 2>/dev/null || true
}

# Polls until /port/path returns the expected status or exits (000).
# Echoes "<result>:<elapsed_ms>".
wait_for_status() {
  local port="${1}" path="${2}" expected="${3}" deadline_ms="${4}"
  local start status elapsed
  start="$(ts)"
  while :; do
    status="$(probe_status "${port}" "${path}" 2)"
    elapsed=$(( $(ts) - start ))
    if [[ "${status}" == "${expected}" ]]; then
      echo "${status}:${elapsed}"
      return 0
    fi
    if [[ "${expected}" == "exit" && "${status}" == "000" ]]; then
      echo "exit:${elapsed}"
      return 0
    fi
    if [[ "${elapsed}" -ge "${deadline_ms}" ]]; then
      echo "${status}:timeout:${elapsed}"
      return 0
    fi
    sleep 0.1
  done
}

# Reads /metrics and surfaces the drainCounters + requestCount bundle.
record_metrics() {
  local label="${1}" port="${2}"
  local body
  body="$(probe_body "${port}" "/metrics" 3)"
  if [[ -z "${body}" ]]; then
    printf '%s' "${label}=empty"
    return
  fi
  printf '%s' "${body}" | node -e '
    let buf = "";
    process.stdin.on("data", d => { buf += d.toString("utf8"); });
    process.stdin.on("end", () => {
      try {
        const obj = JSON.parse(buf);
        // /metrics JSON may carry drain counters as top-level keys
        // (the canonical metrics shape) or nested under `drainCounters`
        // (the cross-instance breaker extension). Accept both.
        const d = obj.drainCounters ?? obj;
        const out = {
          drainInitiatedTotal: d.drainInitiatedTotal ?? null,
          drainCompletedTotal: d.drainCompletedTotal ?? null,
          drainTimeoutTotal: d.drainTimeoutTotal ?? null,
          childHardTimeoutTotal: d.childHardTimeoutTotal ?? null,
          requestCount: obj.requestCount ?? null,
          manifestVersion: obj.manifestVersion ?? null,
        };
        process.stdout.write(JSON.stringify(out));
      } catch (e) {
        process.stdout.write(`{"error":"${e.message}"}`);
      }
    });
  '
}

# ---------------------------------------------------------------------------
# Profile management — drive startTwoInstanceProfile programmatically so
# the new A replacement can be invoked from a fresh fixture too.
# ---------------------------------------------------------------------------

PROFILE_NODE_FILE="${EVIDENCE_DIR}/.profile-node-${PORT_A}-${PORT_B}.mjs"
PROFILE_DESCRIPTOR_FILE="${EVIDENCE_DIR}/.profile-descriptor-${PORT_A}-${PORT_B}.json"

write_profile_node() {
  cat > "${PROFILE_NODE_FILE}" <<NODE
import { writeFileSync } from "node:fs";
import { startTwoInstanceProfile } from "${PROFILE}";
const out = await startTwoInstanceProfile({ portA: ${PORT_A}, portB: ${PORT_B} });
writeFileSync(
  "${PROFILE_DESCRIPTOR_FILE}",
  JSON.stringify({
    pidA: out.instanceA.child.pid,
    pidB: out.instanceB.child.pid,
    portA: out.portA,
    portB: out.portB,
  }),
);
process.on("SIGUSR1", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
await new Promise(() => {});
NODE
}

start_profile() {
  rm -f "${PROFILE_DESCRIPTOR_FILE}"
  write_profile_node
  (cd "${TESTS_DIR}" && node "${PROFILE_NODE_FILE}" >/dev/null 2>&1 & echo $!) >/tmp/_rr_pid_a.txt
  PROFILE_PID="$(cat /tmp/_rr_pid_a.txt)"
  local deadline=$(( $(ts) + 25000 ))
  while [[ ! -s "${PROFILE_DESCRIPTOR_FILE}" ]]; do
    if [[ "$(ts)" -ge "${deadline}" ]]; then
      step_fail "profile never produced descriptor"
    fi
    sleep 0.2
  done
  # Snapshot pidA immediately so we still have it even after the
  # profile process exits and the descriptor file is GC'd.
  PROFILE_A_PID="$(node -e '
    const fs = require("node:fs");
    const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(d.pidA ?? ""));
  ' "${PROFILE_DESCRIPTOR_FILE}")"
  PROFILE_B_PID="$(node -e '
    const fs = require("node:fs");
    const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(d.pidB ?? ""));
  ' "${PROFILE_DESCRIPTOR_FILE}")"
}

# ---------------------------------------------------------------------------
# Main: six steps.
# ---------------------------------------------------------------------------

say "config ports=A:${PORT_A} B:${PORT_B} rps=${RPS} duration=${LOAD_DURATION_S}s log=${LOG_FILE}"
if [[ -n "${GATEWAY_ADMIN_TOKEN:-}" ]]; then
  say "auth: GATEWAY_ADMIN_TOKEN set (length=${#GATEWAY_ADMIN_TOKEN}); step 2 will POST /admin/drain"
else
  say "auth: GATEWAY_ADMIN_TOKEN unset; step 2 will SIGTERM (admin-token-disabled, using SIGTERM path)"
fi

# --- STEP 1: baseline /health/ready on A and B. -------------------------
step "1-baseline-ready"
S1_T0="$(ts)"
start_profile
ready_a="$(probe_status "${PORT_A}" "/health/ready" 3)"
ready_b="$(probe_status "${PORT_B}" "/health/ready" 3)"
S1_T1="$(ts)"
say "step-1 baseline: A=${ready_a} B=${ready_b} (step took $((S1_T1 - S1_T0))ms)"
if [[ "${ready_a}" != "200" || "${ready_b}" != "200" ]]; then
  step_fail "expected A/B /health/ready=200, got A=${ready_a} B=${ready_b}"
fi
step_ok

# --- STEP 2: drain A, B survives. ----------------------------------------
step "2-drain-a"
S2_T0="$(ts)"
admin_used="false"
if [[ -n "${GATEWAY_ADMIN_TOKEN:-}" ]]; then
  say "step-2 POST /admin/drain A:${PORT_A}"
  drain_code="$(curl -sS -o /tmp/_rr_drain.body -w "%{http_code}" --max-time 5 \
    -X POST "http://127.0.0.1:${PORT_A}/admin/drain" \
    -H "Authorization: Bearer ${GATEWAY_ADMIN_TOKEN}" \
    -H "content-type: application/json" -d '{}' 2>/dev/null || echo "000")"
  drain_body="$(cat /tmp/_rr_drain.body 2>/dev/null || echo "")"
  say "step-2 admin: code=${drain_code} body=${drain_body}"
  if [[ "${drain_code}" == "200" ]]; then
    admin_used="true"
    rdy="$(wait_for_status "${PORT_A}" "/health/ready" "503" 5000)"
    say "step-2 readiness after drain: ${rdy}"
    if [[ "${rdy}" != 503:* ]]; then
      step_fail "expected A /health/ready=503 after /admin/drain, got ${rdy}"
    fi
  else
    say "step-2 admin: code=${drain_code}; falling back to SIGTERM"
  fi
else
  say "step-2 admin: GATEWAY_ADMIN_TOKEN unset — SIGTERM path (admin-token-disabled)"
fi

ready_b_after="$(probe_status "${PORT_B}" "/health/ready" 3)"
S2_T1="$(ts)"
say "step-2 B-survives: B /health/ready=${ready_b_after} (step took $((S2_T1 - S2_T0))ms)"
if [[ "${ready_b_after}" != "200" ]]; then
  step_fail "expected B /health/ready=200 while A drains, got ${ready_b_after}"
fi
step_ok

# --- STEP 3: SIGTERM A (if admin path didn't already) and wait exit. ----
step "3-a-exit"
S3_T0="$(ts)"
if [[ "${admin_used}" != "true" ]]; then
  if [[ -z "${PROFILE_A_PID}" ]]; then
    step_fail "no PROFILE_A_PID snapshot"
  fi
  say "step-3 SIGTERM pid=${PROFILE_A_PID}"
  kill -TERM "${PROFILE_A_PID}" >/dev/null 2>&1 || step_fail "kill TERM ${PROFILE_A_PID} failed"
fi
exit_result="$(wait_for_status "${PORT_A}" "/health/ready" "exit" 15000)"
S3_T1="$(ts)"
A_DOWN_START_MS="${S2_T0}"
A_DOWN_END_MS="${S3_T1}"
A_DOWNTIME_MS=$(( A_DOWN_END_MS - A_DOWN_START_MS ))
say "step-3 exit: ${exit_result} (step took $((S3_T1 - S3_T0))ms; A downtime so far ${A_DOWNTIME_MS}ms)"
if [[ "${exit_result}" != exit:* ]]; then
  # Escalate to SIGKILL if A is wedged.
  if [[ -n "${PROFILE_A_PID}" ]]; then
    say "step-3 escalate: SIGKILL pid=${PROFILE_A_PID}"
    kill -KILL "${PROFILE_A_PID}" >/dev/null 2>&1 || true
  fi
fi
step_ok

# --- STEP 4: spawn replacement A. ---------------------------------------
step "4-respawn-a"
S4_T0="$(ts)"
# Spawn the gateway fixture directly on PORT_A so we keep B intact.
(
  cd "${TESTS_DIR}"
  GATEWAY_HA_PORT="${PORT_A}" \
  GATEWAY_HA_LABEL="A-replacement" \
  GATEWAY_HA_DRAIN_ON_SIGNAL="true" \
  "$(node -e 'process.stdout.write(process.execPath)')" \
  "$(node -e 'process.stdout.write(require.resolve("vitest/dist/cli.js"))')" \
    run --root "${TESTS_DIR}" --config "${TESTS_DIR}/vitest.config.ts" \
    gateway-server-fixture.test.ts
) >/dev/null 2>&1 &
REPLACEMENT_A_PID=$!
say "step-4 replacement A pid=${REPLACEMENT_A_PID}"
live_r="$(wait_for_status "${PORT_A}" "/health/live" "200" 25000)"
ready_r="$(wait_for_status "${PORT_A}" "/health/ready" "200" 25000)"
S4_T1="$(ts)"
say "step-4 respawn A: live=${live_r} ready=${ready_r} (step took $((S4_T1 - S4_T0))ms)"
if [[ "${ready_r}" != 200:* ]]; then
  step_fail "replacement A never became /health/ready=200"
fi
step_ok

# --- STEP 5: 20 RPS for 10s on A + B; record /metrics. -------------------
step "5-load-and-metrics"
S5_T0="$(ts)"
total_requests=$(( RPS * LOAD_DURATION_S ))
say "step-5 load: ${total_requests} reqs at ${RPS} RPS for ${LOAD_DURATION_S}s on A=${PORT_A} + B=${PORT_B}"
seq 1 "${total_requests}" | xargs -P 8 -n 1 -I{} sh -c '
  if [ $(( {} % 2 )) -eq 0 ]; then port='"'"${PORT_A}"'"'; else port='"'"${PORT_B}"'"'; fi
  curl -sS -o /dev/null --max-time 5 \
    -H "x-request-id: rolling-restart-{}" \
    "http://127.0.0.1:${port}/health/live" >/dev/null 2>&1 || true
' >/dev/null 2>&1 || true
S5_T1="$(ts)"
say "step-5 load complete in $((S5_T1 - S5_T0))ms"
metrics_a="$(record_metrics "A-replacement" "${PORT_A}")"
metrics_b="$(record_metrics "B-original" "${PORT_B}")"
say "step-5 metrics A: ${metrics_a}"
say "step-5 metrics B: ${metrics_b}"
step_ok

# --- STEP 6: summarise. --------------------------------------------------
step "6-summary"
S6_T0="$(ts)"
TOTAL_ELAPSED_MS=$(( S6_T0 - S1_T0 ))
# Blackout window: time during which *at least one* instance is not /health/ready=200.
# In a 2-instance loopback drill, B stays ready throughout, so blackout=0 — but
# we still measure and report it.
B_BLACKOUT_MS=0
say "step-6 summary:"
say "  total-elapsed: ${TOTAL_ELAPSED_MS}ms"
say "  per-instance-A-downtime: ${A_DOWNTIME_MS}ms"
say "  blackout-window (B unavailable): ${B_BLACKOUT_MS}ms"
say "  step-1 (ms): $((S1_T1 - S1_T0))"
say "  step-2 (ms): $((S2_T1 - S2_T0))"
say "  step-3 (ms): $((S3_T1 - S3_T0))"
say "  step-4 (ms): $((S4_T1 - S4_T0))"
say "  step-5 (ms): $((S5_T1 - S5_T0))"
say "  metrics-A: ${metrics_a}"
say "  metrics-B: ${metrics_b}"
step_ok

say "rolling-restart: exit 0 all-six-steps-ok"
exit 0
