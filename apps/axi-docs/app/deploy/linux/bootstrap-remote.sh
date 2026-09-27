#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_PATH="${1:-/root/axi-docs-deploy.tgz}"
APP_ROOT="${APP_ROOT:-/root/.hermes/apps}"
APP_DIR="${APP_DIR:-$APP_ROOT/axi-docs/app}"
KNOWLEDGE_ROOT="${KNOWLEDGE_ROOT:-/root/.hermes/knowledge}"
HERMES_SYSTEM_DIR="${HERMES_SYSTEM_DIR:-$KNOWLEDGE_ROOT/hermes-system}"
SERVICE_NAME="${SERVICE_NAME:-axi-docs}"

mkdir -p "$APP_ROOT" "$KNOWLEDGE_ROOT" "$HERMES_SYSTEM_DIR"
rm -rf "$APP_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$APP_ROOT"

cd "$APP_DIR"
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@10.33.2 --activate
fi
pnpm install --frozen-lockfile

cat > "$APP_DIR/.env.server" <<'EOF'
NODE_ENV=production
MCP_HTTP_PORT=3010
BIND_ADDRESS=0.0.0.0
OBSIDIAN_PATH=/root/.hermes/knowledge
BLINKO_URL=http://127.0.0.1:1111
BLINKO_TOKEN=
MCP_ANTHROPIC_API_KEY=
AI_MODEL=claude-3-5-haiku-20241022
AXI_DOCS_EXTRA_SOURCES_JSON=[{"id":"hermes-system","name":"Hermes-System","path":"/root/.hermes/knowledge/hermes-system","type":"local","enabled":true,"icon":"folder"}]
EOF

if grep -q '^MINIMAX_CN_API_KEY=' /root/.hermes/.env; then
  MINIMAX_KEY="$(grep '^MINIMAX_CN_API_KEY=' /root/.hermes/.env | head -n1 | cut -d= -f2-)"
  python3 - "$APP_DIR/.env.server" "$MINIMAX_KEY" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
key = sys.argv[2].strip()
text = env_path.read_text(encoding="utf-8")
text = text.replace("MCP_ANTHROPIC_API_KEY=", f"MCP_ANTHROPIC_API_KEY={key}", 1)
env_path.write_text(text, encoding="utf-8")
PY
fi

set -a
. "$APP_DIR/.env.server"
set +a
pnpm build

python3 - "$HERMES_SYSTEM_DIR" <<'PY'
from datetime import date
from pathlib import Path
import re
import sys

dest_root = Path(sys.argv[1])
dest_root.mkdir(parents=True, exist_ok=True)
today = date.today().isoformat()

docs = [
    (Path("/root/.hermes/AGENTS.md"), "Hermes AGENTS", ["hermes", "system", "agents"]),
    (Path("/root/.hermes/BOOTSTRAP.md"), "Hermes Bootstrap", ["hermes", "system", "bootstrap"]),
    (Path("/root/.hermes/IDENTITY.md"), "Hermes Identity", ["hermes", "system", "identity"]),
    (Path("/root/.hermes/TOOLS.md"), "Hermes Tools", ["hermes", "system", "tools"]),
    (Path("/root/.hermes/HEARTBEAT.md"), "Hermes Heartbeat", ["hermes", "system", "heartbeat"]),
    (Path("/root/.hermes/SOUL.md"), "Hermes Soul", ["hermes", "system", "soul"]),
    (Path("/root/.hermes/memories/MEMORY.md"), "Hermes Memory", ["hermes", "memory", "preferences"]),
    (Path("/root/.hermes/memories/USER.md"), "Hermes User Profile", ["hermes", "memory", "user"]),
]

def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "note"

for src_path, title, tags in docs:
    if not src_path.exists():
        continue
    slug = slugify(title)
    body = src_path.read_text(encoding="utf-8")
    frontmatter = "\n".join([
        "---",
        f"id: hermes-system-{slug}",
        f"title: {title}",
        f"tags: [{', '.join(tags)}]",
        "type: reference",
        "status: evergreen",
        f"created: {today}",
        f"modified: {today}",
        f"graph-title: {title}",
        f"graph-tags: [{', '.join(tags)}]",
        "---",
        "",
    ])
    out_path = dest_root / f"{slug}.md"
    out_path.write_text(frontmatter + body, encoding="utf-8")
PY

install -m 0644 "$APP_DIR/deploy/linux/axi-docs.service" "/etc/systemd/system/${SERVICE_NAME}.service"
install -m 0644 "$APP_DIR/deploy/linux/blinko-sync.env.example" "/etc/blinko-sync.env.example"
install -m 0644 "$APP_DIR/deploy/linux/blinko-mirror-sync.service" "/etc/systemd/system/blinko-mirror-sync.service"
install -m 0644 "$APP_DIR/deploy/linux/blinko-mirror-sync.timer" "/etc/systemd/system/blinko-mirror-sync.timer"
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"

if [ -f /etc/blinko-sync.env ]; then
  systemctl enable --now blinko-mirror-sync.timer
else
  echo "[info] /etc/blinko-sync.env 不存在，已跳过启用 blinko-mirror-sync.timer"
fi
