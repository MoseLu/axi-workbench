#!/usr/bin/env python3
"""Convert generated 10x8 pet sheets into app-compatible pet atlases."""

from __future__ import annotations

import argparse
import json
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


CELL_WIDTH = 192
CELL_HEIGHT = 208
COLUMNS = 8
BASE_ROWS = 9
REDRAW_ROWS = 32
SOURCE_COLUMNS = 10
SOURCE_ROWS = 8


@dataclass(frozen=True)
class RowSpec:
    output_row: int
    state: str
    frames: int
    source_row: int


BASE_ROW_SPECS = [
    RowSpec(0, "idle", 6, 0),
    RowSpec(1, "running-right", 8, 1),
    RowSpec(2, "running-left", 8, 2),
    RowSpec(3, "waving", 4, 3),
    RowSpec(4, "jumping", 5, 4),
    RowSpec(5, "failed", 6, 7),
    RowSpec(6, "waiting", 6, 5),
    RowSpec(7, "running", 6, 6),
    RowSpec(8, "review", 6, 7),
]

REDRAW_ROW_SPECS = BASE_ROW_SPECS + [
    RowSpec(9, "running-up", 6, 6),
    RowSpec(10, "running-down", 6, 6),
    RowSpec(11, "running-up-right", 8, 1),
    RowSpec(12, "running-up-left", 8, 2),
    RowSpec(13, "running-down-right", 8, 1),
    RowSpec(14, "running-down-left", 8, 2),
    RowSpec(15, "catching-breath", 6, 5),
    RowSpec(16, "arrive-hands-on-hips", 6, 0),
    RowSpec(17, "arrive-peace", 6, 3),
    RowSpec(18, "dragging", 5, 4),
    RowSpec(19, "head-pat", 6, 0),
    RowSpec(20, "body-tap", 4, 3),
    RowSpec(21, "left-tail-tap", 6, 3),
    RowSpec(22, "right-tail-tap", 6, 3),
    RowSpec(23, "feet-tap", 5, 4),
    RowSpec(24, "idle-blink", 6, 0),
    RowSpec(25, "idle-look-around", 6, 5),
    RowSpec(26, "idle-hair-sway", 6, 0),
    RowSpec(27, "idle-stretch", 8, 4),
    RowSpec(28, "idle-blink-tap", 5, 3),
    RowSpec(29, "idle-look-around-tap", 6, 3),
    RowSpec(30, "idle-hair-sway-tap", 6, 3),
    RowSpec(31, "idle-stretch-tap", 6, 4),
]


def is_background_pixel(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    if alpha == 0:
        return True
    if alpha < 12:
        return True
    return red >= 244 and green >= 244 and blue >= 244


def clear_border_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    queue: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if visited[index]:
            return
        visited[index] = 1
        if is_background_pixel(pixels[x, y]):
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (255, 255, 255, 0)
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if next_x < 0 or next_y < 0 or next_x >= width or next_y >= height:
                continue
            index = next_y * width + next_x
            if visited[index]:
                continue
            visited[index] = 1
            if is_background_pixel(pixels[next_x, next_y]):
                queue.append((next_x, next_y))

    return rgba


def source_cell(source: Image.Image, row: int, column: int) -> Image.Image:
    left = round(source.width * column / SOURCE_COLUMNS)
    right = round(source.width * (column + 1) / SOURCE_COLUMNS)
    top = round(source.height * row / SOURCE_ROWS)
    bottom = round(source.height * (row + 1) / SOURCE_ROWS)
    return clear_border_background(source.crop((left, top, right, bottom)))


def paste_frame(atlas: Image.Image, frame: Image.Image, output_row: int, output_column: int) -> None:
    scale = min(CELL_WIDTH / frame.width, CELL_HEIGHT / frame.height)
    size = (max(1, round(frame.width * scale)), max(1, round(frame.height * scale)))
    resized = frame.resize(size, Image.Resampling.LANCZOS)
    left = output_column * CELL_WIDTH + (CELL_WIDTH - size[0]) // 2
    top = output_row * CELL_HEIGHT + (CELL_HEIGHT - size[1]) // 2
    atlas.alpha_composite(resized, (left, top))


def build_atlas(source: Image.Image, specs: list[RowSpec], rows: int) -> Image.Image:
    atlas = Image.new("RGBA", (CELL_WIDTH * COLUMNS, CELL_HEIGHT * rows), (0, 0, 0, 0))
    for spec in specs:
        for column in range(min(spec.frames, COLUMNS)):
            paste_frame(atlas, source_cell(source, spec.source_row, column), spec.output_row, column)
    return atlas


def validation(atlas: Image.Image, specs: list[RowSpec]) -> dict[str, object]:
    errors: list[str] = []
    warnings: list[str] = []
    cells: list[dict[str, object]] = []
    specs_by_row = {spec.output_row: spec for spec in specs}
    for row in range(atlas.height // CELL_HEIGHT):
        spec = specs_by_row.get(row)
        for column in range(COLUMNS):
            cell = atlas.crop((
                column * CELL_WIDTH,
                row * CELL_HEIGHT,
                (column + 1) * CELL_WIDTH,
                (row + 1) * CELL_HEIGHT,
            ))
            alpha_count = sum(cell.getchannel("A").histogram()[1:])
            used = spec is not None and column < spec.frames
            cells.append({
                "state": spec.state if spec else "unused",
                "row": row,
                "column": column,
                "used": used,
                "nontransparentPixels": alpha_count,
            })
            if used and alpha_count < 80:
                errors.append(f"{spec.state} row {row} col {column} is empty or too sparse")
            if not used and alpha_count:
                warnings.append(f"row {row} col {column} is unused but non-empty")
    return {"ok": not errors, "errors": errors, "warnings": warnings, "cells": cells}


def contact_sheet(atlas: Image.Image) -> Image.Image:
    scale = 0.5
    preview = Image.new("RGBA", atlas.size, (246, 246, 246, 255))
    preview.alpha_composite(atlas)
    return preview.resize((round(atlas.width * scale), round(atlas.height * scale)), Image.Resampling.NEAREST)


def save_webp(image: Image.Image, path: Path) -> None:
    image.save(path, format="WEBP", lossless=True, quality=100, method=6)


def write_pet_json(path: Path, pet_id: str, display_name: str, english_name: str, group: str) -> None:
    payload = {
        "id": pet_id,
        "displayName": display_name,
        "localizedDisplayNames": {
            "zh-Hans": display_name,
            "en": english_name,
        },
        "description": f"Date A Live desktop pet asset for {english_name}.",
        "group": group,
        "spritesheetPath": "spritesheet.png",
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--pet-id", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--english-name", required=True)
    parser.add_argument("--group", default="date-a-live")
    parser.add_argument("--write-pet-json", action="store_true")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(args.source) as opened:
        source = opened.convert("RGBA")

    base = build_atlas(source, BASE_ROW_SPECS, BASE_ROWS)
    redraw = build_atlas(source, REDRAW_ROW_SPECS, REDRAW_ROWS)

    base.save(args.output_dir / "spritesheet.png")
    save_webp(base, args.output_dir / "spritesheet.webp")
    save_webp(redraw, args.output_dir / "spritesheet.redraw.webp")
    contact_sheet(redraw).convert("RGB").save(args.output_dir / "spritesheet.redraw.preview.png")

    base_validation = validation(base, BASE_ROW_SPECS)
    redraw_validation = validation(redraw, REDRAW_ROW_SPECS)
    (args.output_dir / "spritesheet.validation.json").write_text(
        json.dumps(base_validation, indent=2) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "spritesheet.redraw.validation.json").write_text(
        json.dumps(redraw_validation, indent=2) + "\n",
        encoding="utf-8",
    )

    if args.write_pet_json:
        write_pet_json(
            args.output_dir / "pet.json",
            args.pet_id,
            args.display_name,
            args.english_name,
            args.group,
        )

    if not base_validation["ok"] or not redraw_validation["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
