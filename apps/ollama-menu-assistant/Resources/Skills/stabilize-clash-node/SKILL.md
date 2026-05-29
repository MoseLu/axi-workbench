---
name: stabilize-clash-node
description: Find, test, and bind a stable non-Hong-Kong Clash Verge/mihomo node for OpenAI, ChatGPT, Codex App, or other HTTPS streaming traffic when errors such as "tls handshake eof", "stream disconnected before completion", repeated reconnects, SSL_ERROR_SYSCALL, connection reset, i/o timeout, or proxy-node instability occur. Use when Codex should inspect Clash Verge subscriptions/groups, avoid Hong Kong nodes for OpenAI API access, run real TLS/API probes through the local proxy, and switch the active strategy group to the most stable node.
---

# Stabilize Clash Node

## Overview

Use this skill to turn Clash Verge node selection into a repeatable evidence-based workflow. Prefer real `api.openai.com` TLS/HTTP checks over Clash UI latency, because a node can pass generic delay tests but still fail Codex streaming.

## Workflow

1. Confirm Clash Verge/mihomo is running and identify the active runtime:
   - Default Unix socket: `/tmp/verge/verge-mihomo.sock`
   - Default mixed proxy: `http://127.0.0.1:7897`
   - Query `/configs` and `/proxies` before changing anything.

2. If the user permits switching subscriptions, use Computer Use to open Clash Verge -> `订阅`, switch to the next candidate subscription, then run the script against the new runtime. Repeat for each subscription until one produces stable OpenAI checks.

3. Avoid Hong Kong nodes for OpenAI API traffic:
   - Exclude names matching `香港`, `🇭🇰`, or `HK` unless the user explicitly overrides this.
   - Also ignore metadata entries such as quota and expiry pseudo-nodes.

4. Run the bundled script on the current runtime:

```bash
python3 /Users/mose/.codex/skills/stabilize-clash-node/scripts/stabilize_clash_node.py --apply
```

Useful options:

```bash
# Test a specific strategy group
python3 /Users/mose/.codex/skills/stabilize-clash-node/scripts/stabilize_clash_node.py --group 良心云 --apply

# Faster first pass
python3 /Users/mose/.codex/skills/stabilize-clash-node/scripts/stabilize_clash_node.py --attempts 3 --final-attempts 8 --apply

# Monitor the current node and auto-switch after repeated failures
python3 /Users/mose/.codex/skills/stabilize-clash-node/scripts/stabilize_clash_node.py \
  --group 良心云 \
  --monitor \
  --interval 30 \
  --fail-threshold 2 \
  --pool-refresh-interval 300 \
  --pool-probe-mode real \
  --pool-real-attempts 1 \
  --include-regex '日本专线|新加坡专线|美国|韩国|台湾' \
  --pool-workers 8

# Dry run without binding the winner
python3 /Users/mose/.codex/skills/stabilize-clash-node/scripts/stabilize_clash_node.py
```

5. Treat `HTTP 401` from `https://api.openai.com/v1/models` as success. It means TLS, HTTP/2, and the OpenAI API edge are reachable; the request is only unauthenticated.

6. For ongoing instability, prefer monitor mode with a proactive node pool:
   - `--monitor` probes the currently selected node on a loop.
   - `--interval 30` checks every 30 seconds.
   - `--pool-refresh-interval 300` proactively refreshes the non-HK candidate pool every 5 minutes.
   - `--pool-probe-mode real` temporarily cycles candidate nodes and curls the real OpenAI test URL, then restores the original node. This is more accurate than Clash UI delay.
   - `--pool-real-attempts 1` controls how many real OpenAI probes each candidate gets during proactive refresh.
   - `--pool-probe-mode delay` is faster and non-disruptive, but less reliable for OpenAI because generic delay checks can pass while OpenAI TLS fails.
   - `--pool-workers 8` applies only to delay mode; real mode is sequential because the active selector can only point at one node at a time.
   - `--include-regex` can keep the proactive pool focused on known-good regions or tiers.
   - `--pool-limit N` can cap proactive sniffing cost; use `0` for all candidates.
   - `--fail-threshold 2` switches only after 2 consecutive real OpenAI probe failures.
   - On failure, switch from the cached healthy pool immediately, then verify the new node with real OpenAI probes.
   - `--switch-verify-attempts 3` controls post-switch verification.
   - `--pool-max-age 900` forces a pool refresh if cached results are too old.
   - `--monitor-cycles N` is only for testing; omit it for continuous monitoring.

7. To run a monitor in the background for the current shell session:

```bash
nohup python3 /Users/mose/.codex/skills/stabilize-clash-node/scripts/stabilize_clash_node.py \
  --group 良心云 \
  --monitor \
  --interval 30 \
  --fail-threshold 2 \
  --pool-refresh-interval 300 \
  --pool-probe-mode real \
  --pool-real-attempts 1 \
  --include-regex '日本专线|新加坡专线|美国|韩国|台湾' \
  > /tmp/stabilize-clash-node.log 2>&1 &
```

Do not start multiple monitors for the same Clash group. Check with:

```bash
pgrep -af 'stabilize_clash_node.py .*--monitor'
```

8. After the script selects a winner, verify with:

```bash
for i in {1..5}; do
  curl -sS -o /dev/null \
    -w 'http=%{http_code} appconnect=%{time_appconnect} total=%{time_total}\n' \
    --connect-timeout 8 --max-time 15 \
    -x http://127.0.0.1:7897 \
    https://api.openai.com/v1/models || true
  sleep 1
done
```

9. Check the mihomo service log to confirm real traffic is routed through the selected group and node:

```bash
tail -n 60 "$HOME/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev/logs/service/service_latest.log" \
  | rg 'api.openai.com|chatgpt.com|chat.openai.com|ab.chatgpt.com'
```

## Decision Rules

- Prefer a node with all probe attempts successful over a lower median with failures.
- Prefer lower worst-case latency when success counts tie.
- Do not trust `alive: true` alone; use real OpenAI probes.
- If every node in a subscription fails, switch subscription and repeat.
- If the Clash UI home page appears stale, trust the local control API plus service log.
- Leave Clash in `rule` mode unless the user specifically wants global mode.
- Use only one monitor per strategy group; competing monitors can fight over node selection.
- Keep monitor intervals conservative. Ten seconds or less can create unnecessary churn and may interrupt active streams.
- Keep pool refresh less frequent than current-node checks. A good starting point is `--interval 30 --pool-refresh-interval 300`.
- Real pool refresh temporarily changes the selector while it sniffs candidates. Use a longer refresh interval if active streams are sensitive to brief selector changes.
- If real pool refresh takes too long, narrow the candidate pool with `--include-regex` or `--pool-limit`.
- The script installs SIGINT/SIGTERM handlers and tries to restore the original selector if real pool refresh is interrupted.

## Safety

Do not print subscription URLs, passwords, tokens, UUIDs, or full profile contents. The script only reads local runtime state and changes local Clash selector choices.
