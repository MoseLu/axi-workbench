#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/artifacts/snapshots"

mkdir -p "$OUTPUT_DIR"

cd "$ROOT_DIR"
swift build >/dev/null

for kind in empty chat loading offline; do
  "$ROOT_DIR/.build/debug/OllamaMenuAssistant" --snapshot "$kind" "$OUTPUT_DIR/$kind.png" >/dev/null
done

echo "$OUTPUT_DIR"
