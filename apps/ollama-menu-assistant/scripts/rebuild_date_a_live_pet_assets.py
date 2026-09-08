#!/usr/bin/env python3
"""Rebuild damaged Date A Live pet atlases from clean frame components.

This script avoids the legacy 10x8 grid assumption. For most source sheets it
extracts character components by row. For Origami's labeled contact sheet it
extracts only the inside of the table cells, ignoring headers and row labels.
Optionally, a generated idle row can override row 0.
"""

from __future__ import annotations

import argparse
import json
import shutil
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw


CELL_WIDTH = 192
CELL_HEIGHT = 208
COLUMNS = 8
BASE_ROWS = 9
REDRAW_ROWS = 32
ATLAS_WIDTH = CELL_WIDTH * COLUMNS
BASE_HEIGHT = CELL_HEIGHT * BASE_ROWS
REDRAW_HEIGHT = CELL_HEIGHT * REDRAW_ROWS
SAFE_PADDING = 8


@dataclass(frozen=True)
class RowSpec:
    output_row: int
    state: str
    frames: int
    source_row: int


@dataclass(frozen=True)
class PetSpec:
    pet_id: str
    source_file: str
    display_name: str
    english_name: str
    extractor: str
    key: str


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

PETS = [
    PetSpec(
        "kaguya-yamai",
        "kaguya_sprite_1779298674400.png",
        "耶俱矢",
        "Kaguya Yamai",
        "components",
        "#00ff00",
    ),
    PetSpec(
        "yuzuru-yamai",
        "yuzuru_sprite_1779298920205.png",
        "夕弦",
        "Yuzuru Yamai",
        "components",
        "#00ff00",
    ),
    PetSpec(
        "natsumi",
        "natsumi_sprite_1779297919286.png",
        "七罪",
        "Natsumi",
        "components",
        "#ff00ff",
    ),
    PetSpec(
        "origami-tobiichi",
        "origami_tobiichi_sprite_1779297906009.png",
        "折纸",
        "Origami Tobiichi",
        "table",
        "#00ff00",
    ),
    PetSpec(
        "mukuro-hoshimiya",
        "mukuro_sprite_1779298661870.png",
        "六喰",
        "Mukuro Hoshimiya",
        "components",
        "#00ff00",
    ),
]


def parse_key(value: str) -> tuple[int, int, int]:
    value = value.strip().lstrip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def is_near_white(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha <= 12 or (red >= 242 and green >= 242 and blue >= 242)


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
        if is_near_white(pixels[x, y]):
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
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            index = ny * width + nx
            if visited[index]:
                continue
            visited[index] = 1
            if is_near_white(pixels[nx, ny]):
                queue.append((nx, ny))

    return rgba


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def component_bboxes(alpha: Image.Image, minimum_pixels: int = 90) -> list[tuple[int, int, int, int, int]]:
    width, height = alpha.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    boxes: list[tuple[int, int, int, int, int]] = []

    for sy in range(height):
        for sx in range(width):
            start = sy * width + sx
            if visited[start] or pixels[sx, sy] <= 12:
                continue
            queue: deque[tuple[int, int]] = deque([(sx, sy)])
            visited[start] = 1
            min_x = max_x = sx
            min_y = max_y = sy
            count = 0
            while queue:
                x, y = queue.popleft()
                count += 1
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
                for nx in (x - 1, x, x + 1):
                    for ny in (y - 1, y, y + 1):
                        if nx < 0 or ny < 0 or nx >= width or ny >= height or (nx == x and ny == y):
                            continue
                        index = ny * width + nx
                        if visited[index] or pixels[nx, ny] <= 12:
                            continue
                        visited[index] = 1
                        queue.append((nx, ny))
            if count >= minimum_pixels:
                boxes.append((min_x, min_y, max_x + 1, max_y + 1, count))

    return boxes


def row_groups_from_components(image: Image.Image) -> list[list[tuple[int, int, int, int]]]:
    boxes = component_bboxes(image.getchannel("A"), minimum_pixels=250)
    boxes = [(left, top, right, bottom) for left, top, right, bottom, _ in boxes]
    # Drop detached punctuation and tiny prompt artifacts that some legacy
    # source sheets included above valid character frames.
    boxes = [
        box
        for box in boxes
        if (box[2] - box[0]) >= 24 and (box[3] - box[1]) >= 44
    ]
    boxes.sort(key=lambda box: ((box[1] + box[3]) / 2, box[0]))
    groups: list[list[tuple[int, int, int, int]]] = []
    for box in boxes:
        center_y = (box[1] + box[3]) / 2
        for group in groups:
            group_center = sum((item[1] + item[3]) / 2 for item in group) / len(group)
            if abs(center_y - group_center) < 48:
                group.append(box)
                break
        else:
            groups.append([box])
    for group in groups:
        group.sort(key=lambda box: box[0])
    return groups


def extract_component_frames(source: Image.Image, row_index: int) -> list[Image.Image]:
    transparent = clear_border_background(source)
    groups = row_groups_from_components(transparent)
    if row_index >= len(groups):
        raise ValueError(f"source row {row_index} missing; found {len(groups)} rows")
    return [transparent.crop(box) for box in groups[row_index]]


def dark_line_positions(source: Image.Image, axis: str) -> list[int]:
    rgb = source.convert("RGB")
    positions: list[int] = []
    if axis == "x":
        for x in range(rgb.width):
            dark = 0
            for y in range(rgb.height):
                red, green, blue = rgb.getpixel((x, y))
                if red < 45 and green < 45 and blue < 45:
                    dark += 1
            if dark > rgb.height * 0.35:
                positions.append(x)
    else:
        for y in range(rgb.height):
            dark = 0
            for x in range(rgb.width):
                red, green, blue = rgb.getpixel((x, y))
                if red < 45 and green < 45 and blue < 45:
                    dark += 1
            if dark > rgb.width * 0.35:
                positions.append(y)

    clusters: list[list[int]] = []
    for value in positions:
        if clusters and value - clusters[-1][-1] <= 2:
            clusters[-1].append(value)
        else:
            clusters.append([value])
    return [round(sum(cluster) / len(cluster)) for cluster in clusters]


def extract_table_frames(source: Image.Image, row_index: int) -> list[Image.Image]:
    x_lines = dark_line_positions(source, "x")
    y_lines = dark_line_positions(source, "y")
    if len(x_lines) < 9 or len(y_lines) < 10:
        raise ValueError("could not detect enough table grid lines")

    # Origami's row labels are outside the table; the numeric header occupies
    # the first y segment. Runtime rows start below the header.
    frames: list[Image.Image] = []
    row_top = y_lines[row_index + 1]
    row_bottom = y_lines[row_index + 2]
    x_offset = 1 if len(x_lines) >= 10 else 0
    for column_index in range(8):
        left = x_lines[column_index + x_offset]
        right = x_lines[column_index + x_offset + 1]
        crop = source.crop((left + 3, row_top + 3, right - 3, row_bottom - 3))
        frames.append(clear_border_background(crop))
    return frames


def fit_frame(frame: Image.Image) -> Image.Image:
    transparent = clear_border_background(frame)
    bbox = alpha_bbox(transparent)
    output = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
    if bbox is None:
        return output
    cropped = transparent.crop(bbox)
    scale = min(
        (CELL_WIDTH - SAFE_PADDING * 2) / cropped.width,
        (CELL_HEIGHT - SAFE_PADDING * 2) / cropped.height,
    )
    size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    output.alpha_composite(resized, ((CELL_WIDTH - size[0]) // 2, (CELL_HEIGHT - size[1]) // 2))
    return output


def normalize_override_row(path: Path, key: tuple[int, int, int]) -> Image.Image:
    from pet_redraw_refine import normalize_generated_row

    return normalize_generated_row(path, 6, key)


def build_strip(frames: list[Image.Image], frame_count: int) -> Image.Image:
    output = Image.new("RGBA", (ATLAS_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
    if not frames:
        return output
    if len(frames) < frame_count:
        frames = frames + [frames[-1]] * (frame_count - len(frames))
    for column, frame in enumerate(frames[:frame_count]):
        output.alpha_composite(fit_frame(frame), (column * CELL_WIDTH, 0))
    return output


def build_atlas(
    pet: PetSpec,
    source_root: Path,
    idle_root: Path,
    output_root: Path,
    rows: list[RowSpec],
) -> Image.Image:
    source = Image.open(source_root / pet.source_file).convert("RGBA")
    atlas = Image.new("RGBA", (ATLAS_WIDTH, CELL_HEIGHT * len(rows)), (0, 0, 0, 0))
    cache: dict[int, list[Image.Image]] = {}
    for spec in rows:
        override = idle_root / f"{pet.pet_id}-idle-source.png"
        if spec.output_row == 0 and override.exists():
            strip = normalize_override_row(override, parse_key(pet.key))
        else:
            if spec.source_row not in cache:
                if pet.extractor == "table":
                    cache[spec.source_row] = extract_table_frames(source, spec.source_row)
                else:
                    cache[spec.source_row] = extract_component_frames(source, spec.source_row)
            strip = build_strip(cache[spec.source_row], spec.frames)
        atlas.alpha_composite(strip, (0, spec.output_row * CELL_HEIGHT))

    pet_output = output_root / pet.pet_id
    pet_output.mkdir(parents=True, exist_ok=True)
    return atlas


def write_atlas(atlas: Image.Image, png_path: Path, webp_path: Path) -> None:
    png_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(png_path)
    atlas.save(webp_path, format="WEBP", lossless=True, quality=100, method=6)


def write_pet_json(pet: PetSpec, path: Path) -> None:
    payload = {
        "id": pet.pet_id,
        "displayName": pet.display_name,
        "localizedDisplayNames": {
            "zh-Hans": pet.display_name,
            "en": pet.english_name,
        },
        "description": f"Date A Live desktop pet asset for {pet.english_name}.",
        "group": "date-a-live",
        "spritesheetPath": "spritesheet.webp",
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def cell_metrics(cell: Image.Image) -> dict[str, int]:
    alpha = cell.getchannel("A")
    nontransparent = sum(alpha.histogram()[1:])
    border = 0
    for x in range(CELL_WIDTH):
        for y in list(range(SAFE_PADDING)) + list(range(CELL_HEIGHT - SAFE_PADDING, CELL_HEIGHT)):
            if alpha.getpixel((x, y)) > 12:
                border += 1
    for y in range(SAFE_PADDING, CELL_HEIGHT - SAFE_PADDING):
        for x in list(range(SAFE_PADDING)) + list(range(CELL_WIDTH - SAFE_PADDING, CELL_WIDTH)):
            if alpha.getpixel((x, y)) > 12:
                border += 1
    return {"nontransparentPixels": nontransparent, "safeBorderPixels": border}


def validate_atlas(atlas: Image.Image, rows: list[RowSpec]) -> dict[str, object]:
    errors: list[str] = []
    warnings: list[str] = []
    cells: list[dict[str, object]] = []
    expected_size = (ATLAS_WIDTH, CELL_HEIGHT * len(rows))
    if atlas.size != expected_size:
        errors.append(f"expected {expected_size[0]}x{expected_size[1]}, got {atlas.width}x{atlas.height}")

    for spec in rows:
        for column in range(COLUMNS):
            cell = atlas.crop((
                column * CELL_WIDTH,
                spec.output_row * CELL_HEIGHT,
                (column + 1) * CELL_WIDTH,
                (spec.output_row + 1) * CELL_HEIGHT,
            ))
            metrics = cell_metrics(cell)
            used = column < spec.frames
            cells.append({"row": spec.output_row, "state": spec.state, "column": column, "used": used, **metrics})
            if used and metrics["nontransparentPixels"] < 400:
                errors.append(f"{spec.state} row {spec.output_row} col {column} is empty or too sparse")
            if not used and metrics["nontransparentPixels"]:
                errors.append(f"{spec.state} row {spec.output_row} col {column} should be transparent")
            if used and metrics["safeBorderPixels"]:
                warnings.append(f"{spec.state} row {spec.output_row} col {column} touches {SAFE_PADDING}px safe border")
    return {"ok": not errors, "errors": errors, "warnings": warnings, "cells": cells}


def contact_sheet(atlas: Image.Image, rows: list[RowSpec], output: Path) -> None:
    scale = 0.5
    label_width = 180
    row_height = round(CELL_HEIGHT * scale)
    sheet = Image.new("RGBA", (label_width + round(ATLAS_WIDTH * scale), row_height * len(rows)), (245, 245, 245, 255))
    draw = ImageDraw.Draw(sheet)
    for spec in rows:
        strip = atlas.crop((0, spec.output_row * CELL_HEIGHT, ATLAS_WIDTH, (spec.output_row + 1) * CELL_HEIGHT))
        strip = strip.resize((round(ATLAS_WIDTH * scale), row_height), Image.Resampling.NEAREST)
        y = spec.output_row * row_height
        draw.text((8, y + 8), f"{spec.output_row:02d} {spec.state}", fill=(0, 0, 0, 255))
        sheet.alpha_composite(strip, (label_width, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output, quality=95)


def write_row_gifs(atlas: Image.Image, rows: list[RowSpec], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for spec in rows:
        frames: list[Image.Image] = []
        for column in range(spec.frames):
            cell = atlas.crop((
                column * CELL_WIDTH,
                spec.output_row * CELL_HEIGHT,
                (column + 1) * CELL_WIDTH,
                (spec.output_row + 1) * CELL_HEIGHT,
            ))
            bg = Image.new("RGBA", cell.size, (245, 245, 245, 255))
            bg.alpha_composite(cell)
            frames.append(bg.convert("P", palette=Image.Palette.ADAPTIVE))
        if frames:
            frames[0].save(
                output_dir / f"{spec.output_row:02d}-{spec.state}.gif",
                save_all=True,
                append_images=frames[1:],
                duration=130,
                loop=0,
                disposal=2,
            )


def install_outputs(pet_output: Path, pet: PetSpec, pet_roots: list[Path]) -> None:
    timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    for root in pet_roots:
        target = root / pet.pet_id
        target.mkdir(parents=True, exist_ok=True)
        backup = target / f"backup-{timestamp}"
        backup.mkdir(exist_ok=True)
        for name in ("pet.json", "spritesheet.png", "spritesheet.webp", "spritesheet.redraw.webp"):
            existing = target / name
            if existing.exists():
                shutil.copy2(existing, backup / name)
        shutil.copy2(pet_output / "pet.json", target / "pet.json")
        shutil.copy2(pet_output / "spritesheet.png", target / "spritesheet.png")
        shutil.copy2(pet_output / "spritesheet.webp", target / "spritesheet.webp")
        shutil.copy2(pet_output / "spritesheet.redraw.webp", target / "spritesheet.redraw.webp")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--idle-root", required=True)
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--install", action="store_true")
    parser.add_argument("--pet-root", action="append", default=[])
    args = parser.parse_args()

    source_root = Path(args.source_root)
    idle_root = Path(args.idle_root)
    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)
    summary: dict[str, object] = {}

    for pet in PETS:
        pet_output = output_root / pet.pet_id
        base = build_atlas(pet, source_root, idle_root, output_root, BASE_ROW_SPECS)
        redraw = build_atlas(pet, source_root, idle_root, output_root, REDRAW_ROW_SPECS)
        write_atlas(base, pet_output / "spritesheet.png", pet_output / "spritesheet.webp")
        redraw.save(pet_output / "spritesheet.redraw.webp", format="WEBP", lossless=True, quality=100, method=6)
        write_pet_json(pet, pet_output / "pet.json")
        contact_sheet(base, BASE_ROW_SPECS, pet_output / "contact-sheet-base.jpg")
        contact_sheet(redraw, REDRAW_ROW_SPECS, pet_output / "contact-sheet-redraw.jpg")
        write_row_gifs(redraw, REDRAW_ROW_SPECS, pet_output / "row-gifs")
        result = {
            "base": validate_atlas(base, BASE_ROW_SPECS),
            "redraw": validate_atlas(redraw, REDRAW_ROW_SPECS),
        }
        (pet_output / "validation.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        summary[pet.pet_id] = {
            "baseOk": result["base"]["ok"],
            "redrawOk": result["redraw"]["ok"],
            "baseWarnings": len(result["base"]["warnings"]),
            "redrawWarnings": len(result["redraw"]["warnings"]),
        }
        if args.install:
            install_outputs(pet_output, pet, [Path(path) for path in args.pet_root])

    (output_root / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
