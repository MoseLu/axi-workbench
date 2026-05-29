#!/usr/bin/env python3
"""Find and bind a stable non-HK Clash Verge/mihomo node for OpenAI traffic."""

from __future__ import annotations

import argparse
import json
import re
import signal
import socket
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime
from http.client import HTTPConnection
from typing import Any
from urllib.parse import quote


CONTROL_SOCKET = "/tmp/verge/verge-mihomo.sock"
PROXY_URL = "http://127.0.0.1:7897"
OPENAI_TEST_URL = "https://api.openai.com/v1/models"
DEFAULT_EXCLUDE = r"香港|🇭🇰|\bHK\b"
GROUP_TYPES = {"Selector", "URLTest", "Fallback", "LoadBalance", "Relay"}
LEAF_SKIP_TYPES = {
    "Selector",
    "URLTest",
    "Fallback",
    "LoadBalance",
    "Relay",
    "Direct",
    "Reject",
    "RejectDrop",
    "Compatible",
    "Pass",
}
PSEUDO_NODE = re.compile(r"^(DIRECT|REJECT|自动选择|故障转移|剩余流量|套餐到期|到期时间|官网|登录)")
RESTORE_STATE: dict[str, str | None] = {"socket": None, "group": None, "node": None}


class UnixHTTPConnection(HTTPConnection):
    def __init__(self, socket_path: str, timeout: float = 8.0):
        super().__init__("localhost", timeout=timeout)
        self.socket_path = socket_path

    def connect(self) -> None:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(self.timeout)
        sock.connect(self.socket_path)
        self.sock = sock


def api(socket_path: str, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    conn = UnixHTTPConnection(socket_path)
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"} if payload else {}
    conn.request(method, path, payload, headers)
    response = conn.getresponse()
    data = response.read().decode("utf-8", errors="replace")
    conn.close()
    if response.status >= 400:
        raise RuntimeError(f"{method} {path} failed with HTTP {response.status}: {data[:200]}")
    return json.loads(data) if data else None


def put_selector(socket_path: str, group: str, node: str) -> None:
    api(socket_path, "PUT", f"/proxies/{quote(group, safe='')}", {"name": node})


def remember_restore(socket_path: str | None, group: str | None, node: str | None) -> None:
    RESTORE_STATE["socket"] = socket_path
    RESTORE_STATE["group"] = group
    RESTORE_STATE["node"] = node


def restore_remembered_node() -> None:
    socket_path = RESTORE_STATE.get("socket")
    group = RESTORE_STATE.get("group")
    node = RESTORE_STATE.get("node")
    if socket_path and group and node:
        try:
            put_selector(socket_path, group, node)
            log(f"restored {group}: {node}")
        except Exception as exc:  # noqa: BLE001 - best-effort signal cleanup.
            log(f"restore failed for {group}: {exc}")
    remember_restore(None, None, None)


def handle_shutdown(signum: int, _frame: object) -> None:
    log(f"received signal {signum}; restoring selector before exit")
    restore_remembered_node()
    raise SystemExit(128 + signum)


@dataclass
class Probe:
    ok: bool
    http_code: str
    appconnect: float
    total: float
    error: str


@dataclass
class Result:
    node: str
    ok: int
    fail: int
    median: float
    worst: float
    probes: list[Probe]


@dataclass
class PoolEntry:
    node: str
    ok: bool
    delay_ms: int
    message: str
    checked_at: float


def curl_probe(proxy_url: str, test_url: str, healthy_status: set[str], timeout: int) -> Probe:
    proc = subprocess.run(
        [
            "curl",
            "-sS",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code} %{time_appconnect} %{time_total}",
            "--connect-timeout",
            str(timeout),
            "--max-time",
            str(max(timeout + 7, 15)),
            "-x",
            proxy_url,
            test_url,
        ],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    parts = proc.stdout.strip().split()
    http_code = parts[0] if parts else "000"
    appconnect = float(parts[1]) if len(parts) > 1 else 0.0
    total = float(parts[2]) if len(parts) > 2 else 0.0
    error = proc.stderr.strip().splitlines()[-1] if proc.stderr.strip() else ""
    ok = proc.returncode == 0 and http_code in healthy_status
    return Probe(ok, http_code, appconnect, total, error)


def node_delay_probe(socket_path: str, node: str, test_url: str, timeout_ms: int) -> PoolEntry:
    path = (
        f"/proxies/{quote(node, safe='')}/delay"
        f"?timeout={timeout_ms}&url={quote(test_url, safe='')}"
    )
    checked_at = time.time()
    try:
        response = api(socket_path, "GET", path)
    except Exception as exc:  # noqa: BLE001 - command-line diagnostics should keep going.
        return PoolEntry(node=node, ok=False, delay_ms=999999, message=str(exc), checked_at=checked_at)

    delay = response.get("delay") if isinstance(response, dict) else None
    if isinstance(delay, int):
        return PoolEntry(node=node, ok=True, delay_ms=delay, message="", checked_at=checked_at)
    message = response.get("message", "no delay returned") if isinstance(response, dict) else "invalid response"
    return PoolEntry(node=node, ok=False, delay_ms=999999, message=str(message), checked_at=checked_at)


def node_real_probe(
    args: argparse.Namespace,
    healthy_status: set[str],
    group: str,
    node: str,
) -> PoolEntry:
    result = probe_node(args, healthy_status, group, node, args.pool_real_attempts)
    ok = result.ok == args.pool_real_attempts
    delay_ms = int(result.median * 1000) if ok else 999999
    message = f"{result.ok}/{args.pool_real_attempts} median={result.median:.3f}s worst={result.worst:.3f}s"
    return PoolEntry(node=node, ok=ok, delay_ms=delay_ms, message=message, checked_at=time.time())


def choose_group(proxies: dict[str, Any], requested: str | None) -> str:
    if requested:
        if requested not in proxies:
            raise SystemExit(f"Group not found: {requested}")
        return requested

    selectors = [
        (name, proxy)
        for name, proxy in proxies.items()
        if proxy.get("type") in GROUP_TYPES and proxy.get("all")
    ]
    non_global = [(name, proxy) for name, proxy in selectors if name != "GLOBAL"]
    preferred = [
        (name, proxy)
        for name, proxy in non_global
        if not re.search(r"自动|故障|fallback|url", name, re.I)
    ]
    pool = preferred or non_global or selectors
    if not pool:
        raise SystemExit("No selector groups found in mihomo runtime.")
    return max(pool, key=lambda item: len(item[1].get("all", [])))[0]


def candidate_nodes(
    proxies: dict[str, Any],
    group: str,
    exclude: re.Pattern[str],
    include: re.Pattern[str] | None = None,
) -> list[str]:
    group_proxy = proxies[group]
    nodes: list[str] = []
    for name in group_proxy.get("all", []):
        proxy = proxies.get(name)
        if not proxy:
            continue
        if proxy.get("type") in LEAF_SKIP_TYPES:
            continue
        if PSEUDO_NODE.search(name):
            continue
        if exclude.search(name):
            continue
        if include and not include.search(name):
            continue
        nodes.append(name)
    return nodes


def summarize(probes: list[Probe]) -> tuple[int, int, float, float]:
    ok_probes = [probe for probe in probes if probe.ok]
    totals = sorted(probe.total for probe in ok_probes)
    ok = len(ok_probes)
    fail = len(probes) - ok
    median = totals[len(totals) // 2] if totals else 999.0
    worst = totals[-1] if totals else 999.0
    return ok, fail, median, worst


def rank_key(result: Result) -> tuple[int, int, float, float]:
    return (-result.ok, result.fail, result.median, result.worst)


def pool_rank_key(entry: PoolEntry) -> tuple[int, int, str]:
    return (0 if entry.ok else 1, entry.delay_ms, entry.node)


def log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}", flush=True)


def load_runtime(
    socket_path: str,
    requested_group: str | None,
    exclude: re.Pattern[str],
    include: re.Pattern[str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any], str, str | None, list[str]]:
    configs = api(socket_path, "GET", "/configs")
    proxies = api(socket_path, "GET", "/proxies")["proxies"]
    group = choose_group(proxies, requested_group)
    original = proxies[group].get("now")
    candidates = candidate_nodes(proxies, group, exclude, include)
    return configs, proxies, group, original, candidates


def probe_current(args: argparse.Namespace, healthy_status: set[str]) -> Probe:
    return curl_probe(args.proxy, args.test_url, healthy_status, args.connect_timeout)


def probe_node(
    args: argparse.Namespace,
    healthy_status: set[str],
    group: str,
    node: str,
    attempts: int,
) -> Result:
    put_selector(args.socket, group, node)
    time.sleep(args.settle)
    probes = [
        curl_probe(args.proxy, args.test_url, healthy_status, args.connect_timeout)
        for _ in range(attempts)
    ]
    ok, fail, median, worst = summarize(probes)
    return Result(node, ok, fail, median, worst, probes)


def select_best_node(
    args: argparse.Namespace,
    healthy_status: set[str],
    exclude: re.Pattern[str],
    apply: bool,
    attempts: int | None = None,
    final_attempts: int | None = None,
) -> tuple[str, int, int]:
    include = re.compile(args.include_regex, re.I) if args.include_regex else None
    configs, _proxies, group, original, candidates = load_runtime(args.socket, args.group, exclude, include)

    print(f"mode: {configs.get('mode')}  mixed-port: {configs.get('mixed-port')}")
    print(f"group: {group}")
    print(f"original: {original}")
    print(f"candidates excluding regex {args.exclude_regex!r}: {len(candidates)}")
    if not candidates:
        raise SystemExit("No candidate leaf nodes found after exclusions.")

    probe_attempts = attempts if attempts is not None else args.attempts
    results: list[Result] = []
    for node in candidates:
        result = probe_node(args, healthy_status, group, node, probe_attempts)
        results.append(result)
        print(
            f"{result.ok}/{probe_attempts} median={result.median:.3f}s "
            f"worst={result.worst:.3f}s fail={result.fail} {node}"
        )

    ranked = sorted(results, key=rank_key)
    print("\nRanked:")
    for result in ranked[: args.top]:
        print(
            f"{result.ok}/{probe_attempts} median={result.median:.3f}s "
            f"worst={result.worst:.3f}s fail={result.fail} {result.node}"
        )

    winner = ranked[0]
    if apply:
        put_selector(args.socket, group, winner.node)
        time.sleep(args.settle)
        print(f"\nSelected {group}: {winner.node}")
    else:
        if original:
            put_selector(args.socket, group, original)
        print(f"\nDry run only. Best candidate: {winner.node}")

    verify_attempts = final_attempts if final_attempts is not None else args.final_attempts
    final_probes = [
        curl_probe(args.proxy, args.test_url, healthy_status, args.connect_timeout)
        for _ in range(verify_attempts)
    ]
    ok, fail, median, worst = summarize(final_probes)
    print(f"Final verification: {ok}/{verify_attempts} median={median:.3f}s worst={worst:.3f}s fail={fail}")
    for probe in final_probes:
        print(f"  http={probe.http_code} appconnect={probe.appconnect:.3f}s total={probe.total:.3f}s")

    return winner.node, ok, verify_attempts


def refresh_pool(
    args: argparse.Namespace,
    healthy_status: set[str],
    exclude: re.Pattern[str],
) -> tuple[str, list[PoolEntry]]:
    include = re.compile(args.include_regex, re.I) if args.include_regex else None
    _configs, _proxies, group, current, candidates = load_runtime(args.socket, args.group, exclude, include)
    if args.pool_limit > 0:
        candidates = candidates[: args.pool_limit]
    entries: list[PoolEntry] = []
    if args.pool_probe_mode == "delay":
        with ThreadPoolExecutor(max_workers=max(1, args.pool_workers)) as executor:
            futures = [
                executor.submit(node_delay_probe, args.socket, node, args.test_url, args.pool_probe_timeout)
                for node in candidates
            ]
            for future in as_completed(futures):
                entries.append(future.result())
    else:
        log(f"real pool sniff start; temporarily cycling {len(candidates)} candidates, then restoring {current}")
        remember_restore(args.socket, group, current)
        try:
            for node in candidates:
                entries.append(node_real_probe(args, healthy_status, group, node))
        finally:
            restore_remembered_node()
            time.sleep(args.settle)

    entries.sort(key=pool_rank_key)
    healthy = [entry for entry in entries if entry.ok]
    summary = ", ".join(f"{entry.node}={entry.delay_ms}ms" for entry in healthy[: args.top])
    log(f"pool refresh mode={args.pool_probe_mode} group={group} healthy={len(healthy)}/{len(entries)} top=[{summary}]")
    return group, entries


def choose_pool_candidate(pool: list[PoolEntry], current: str | None, blocked: set[str]) -> PoolEntry | None:
    for entry in pool:
        if not entry.ok:
            continue
        if entry.node == current:
            continue
        if entry.node in blocked:
            continue
        return entry
    return None


def switch_from_pool(
    args: argparse.Namespace,
    healthy_status: set[str],
    exclude: re.Pattern[str],
    pool: list[PoolEntry],
    blocked: set[str],
) -> tuple[bool, list[PoolEntry]]:
    include = re.compile(args.include_regex, re.I) if args.include_regex else None
    _configs, _proxies, group, current, _candidates = load_runtime(args.socket, args.group, exclude, include)

    candidate = choose_pool_candidate(pool, current, blocked)
    if candidate is None:
        log("no cached healthy candidate found; keeping current node until the next scheduled pool refresh")
        return False, pool

    log(f"switching {group}: {current} -> {candidate.node} ({candidate.delay_ms}ms cached)")
    put_selector(args.socket, group, candidate.node)
    time.sleep(args.settle)

    probes = [
        curl_probe(args.proxy, args.test_url, healthy_status, args.connect_timeout)
        for _ in range(args.switch_verify_attempts)
    ]
    ok, fail, median, worst = summarize(probes)
    if ok == args.switch_verify_attempts:
        log(f"switch verified {candidate.node}: {ok}/{args.switch_verify_attempts} median={median:.3f}s worst={worst:.3f}s")
        return True, pool

    blocked.add(candidate.node)
    log(f"switch candidate failed verification {candidate.node}: {ok}/{args.switch_verify_attempts} fail={fail}; trying another cached node")
    return switch_from_pool(args, healthy_status, exclude, pool, blocked)


def monitor(args: argparse.Namespace, healthy_status: set[str], exclude: re.Pattern[str]) -> int:
    include = re.compile(args.include_regex, re.I) if args.include_regex else None
    _configs, _proxies, group, current, candidates = load_runtime(args.socket, args.group, exclude, include)
    if not candidates:
        raise SystemExit("No candidate leaf nodes found after exclusions.")

    log(f"monitoring group={group} current={current} interval={args.interval}s fail-threshold={args.fail_threshold}")
    pool: list[PoolEntry] = []
    next_pool_refresh = time.time()
    consecutive_failures = 0
    cycles = 0

    while True:
        cycles += 1
        now = time.time()
        if now >= next_pool_refresh:
            group, pool = refresh_pool(args, healthy_status, exclude)
            next_pool_refresh = now + args.pool_refresh_interval

        probe = probe_current(args, healthy_status)
        include = re.compile(args.include_regex, re.I) if args.include_regex else None
        _configs, _proxies, group, current, _candidates = load_runtime(args.socket, args.group, exclude, include)
        if probe.ok:
            consecutive_failures = 0
            log(f"ok current={current} http={probe.http_code} appconnect={probe.appconnect:.3f}s total={probe.total:.3f}s")
        else:
            consecutive_failures += 1
            detail = probe.error or f"http={probe.http_code}"
            log(f"fail {consecutive_failures}/{args.fail_threshold} current={current} {detail}")

        if consecutive_failures >= args.fail_threshold:
            log("failure threshold reached; switching from cached pool")
            switched, pool = switch_from_pool(args, healthy_status, exclude, pool, blocked={current} if current else set())
            consecutive_failures = 0 if switched else 1

        if args.monitor_cycles and cycles >= args.monitor_cycles:
            log(f"monitor cycle limit reached: {args.monitor_cycles}")
            return 0

        time.sleep(args.interval)


def main() -> int:
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--socket", default=CONTROL_SOCKET, help="mihomo Unix control socket")
    parser.add_argument("--proxy", default=PROXY_URL, help="local mixed proxy URL")
    parser.add_argument("--group", help="selector group to test; defaults to the largest non-GLOBAL selector")
    parser.add_argument("--test-url", default=OPENAI_TEST_URL, help="URL to probe through the proxy")
    parser.add_argument("--healthy-status", default="401", help="comma-separated HTTP statuses treated as success")
    parser.add_argument("--exclude-regex", default=DEFAULT_EXCLUDE, help="node-name regex to exclude")
    parser.add_argument("--include-regex", help="optional node-name regex to include in the candidate pool")
    parser.add_argument("--attempts", type=int, default=5, help="probe attempts per candidate")
    parser.add_argument("--final-attempts", type=int, default=12, help="verification attempts for the winner")
    parser.add_argument("--connect-timeout", type=int, default=8, help="curl connect timeout seconds")
    parser.add_argument("--settle", type=float, default=1.2, help="seconds to wait after switching nodes")
    parser.add_argument("--apply", action="store_true", help="bind the winning node after tests")
    parser.add_argument("--top", type=int, default=12, help="ranked results to print")
    parser.add_argument("--monitor", action="store_true", help="keep probing the current node and rescan/switch after repeated failures")
    parser.add_argument("--interval", type=float, default=30.0, help="seconds between monitor probes")
    parser.add_argument("--fail-threshold", type=int, default=2, help="consecutive monitor failures before rescanning")
    parser.add_argument("--monitor-cycles", type=int, default=0, help="number of monitor cycles to run; 0 means forever")
    parser.add_argument("--pool-refresh-interval", type=float, default=300.0, help="seconds between proactive node-pool probes")
    parser.add_argument("--pool-probe-mode", choices=["real", "delay"], default="real", help="pool refresh method: real temporarily switches nodes and curls the test URL; delay uses mihomo delay API")
    parser.add_argument("--pool-real-attempts", type=int, default=1, help="real OpenAI probes per candidate during proactive pool refresh")
    parser.add_argument("--pool-limit", type=int, default=0, help="maximum candidates to sniff during pool refresh; 0 means all candidates")
    parser.add_argument("--pool-probe-timeout", type=int, default=5000, help="mihomo per-node pool probe timeout in milliseconds")
    parser.add_argument("--pool-workers", type=int, default=8, help="parallel workers for proactive node-pool probes")
    parser.add_argument("--pool-max-age", type=float, default=900.0, help="maximum age in seconds before cached pool is considered stale")
    parser.add_argument("--switch-verify-attempts", type=int, default=3, help="real OpenAI probes after switching to a cached pool node")
    args = parser.parse_args()

    healthy_status = {item.strip() for item in args.healthy_status.split(",") if item.strip()}
    exclude = re.compile(args.exclude_regex, re.I)

    if args.monitor:
        return monitor(args, healthy_status, exclude)

    _winner, ok, total = select_best_node(args, healthy_status, exclude, apply=args.apply)
    return 0 if ok == total else 2


if __name__ == "__main__":
    raise SystemExit(main())
