#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
CONVERTER="$SCRIPT_DIR/scripts/normalize_legacy_pet_sheet.py"
PET_DIRS=(
  "$HOME/Library/Application Support/OllamaMenuAssistant/Pets"
  "$HOME/.codex/pets"
)
BRAIN_DIR="/Users/mose/.gemini/antigravity-cli/brain/01585eb0-aefb-47e4-b43c-fbcc6fe43381"

PETS=(
  "kurumi-tokisaki|kurumi_sprite_base_1779297694668.png|时崎狂三|Kurumi Tokisaki"
  "origami-tobiichi|origami_tobiichi_sprite_1779297906009.png|折纸|Origami Tobiichi"
  "natsumi|natsumi_sprite_1779297919286.png|七罪|Natsumi"
  "mukuro-hoshimiya|mukuro_sprite_1779298661870.png|六喰|Mukuro Hoshimiya"
  "kaguya-yamai|kaguya_sprite_1779298674400.png|耶俱矢|Kaguya Yamai"
  "yuzuru-yamai|yuzuru_sprite_1779298920205.png|夕弦|Yuzuru Yamai"
)

for info in "${PETS[@]}"; do
  IFS='|' read -r id filename zh en <<< "$info"

  for pet_dir in "${PET_DIRS[@]}"; do
    target_dir="$pet_dir/$id"
    echo "Processing $id -> $target_dir"
    python3 "$CONVERTER" \
      --source "$BRAIN_DIR/$filename" \
      --output-dir "$target_dir" \
      --pet-id "$id" \
      --display-name "$zh" \
      --english-name "$en" \
      --write-pet-json
  done
done
