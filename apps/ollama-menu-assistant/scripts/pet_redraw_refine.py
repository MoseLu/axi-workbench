#!/usr/bin/env python3
"""Normalize generated redraw row strips and patch 32-row pet atlases."""

from __future__ import annotations

import argparse
import json
import math
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


CELL_WIDTH = 192
CELL_HEIGHT = 208
COLUMNS = 8
ROWS = 32
ATLAS_WIDTH = CELL_WIDTH * COLUMNS
ATLAS_HEIGHT = CELL_HEIGHT * ROWS
KEY_DISTANCE = 48


@dataclass(frozen=True)
class RowSpec:
    row: int
    state: str
    frames: int


ROW_SPECS = [
    RowSpec(0, "idle", 6),
    RowSpec(1, "running-right", 8),
    RowSpec(2, "running-left", 8),
    RowSpec(3, "waving", 4),
    RowSpec(4, "jumping", 5),
    RowSpec(5, "failed", 6),
    RowSpec(6, "waiting", 6),
    RowSpec(7, "running", 6),
    RowSpec(8, "review", 6),
    RowSpec(9, "running-up", 6),
    RowSpec(10, "running-down", 6),
    RowSpec(11, "running-up-right", 8),
    RowSpec(12, "running-up-left", 8),
    RowSpec(13, "running-down-right", 8),
    RowSpec(14, "running-down-left", 8),
    RowSpec(15, "catching-breath", 6),
    RowSpec(16, "arrive-hands-on-hips", 6),
    RowSpec(17, "arrive-peace", 6),
    RowSpec(18, "dragging", 5),
    RowSpec(19, "head-pat", 6),
    RowSpec(20, "body-tap", 4),
    RowSpec(21, "left-tail-tap", 6),
    RowSpec(22, "right-tail-tap", 6),
    RowSpec(23, "feet-tap", 5),
    RowSpec(24, "idle-blink", 6),
    RowSpec(25, "idle-look-around", 6),
    RowSpec(26, "idle-hair-sway", 6),
    RowSpec(27, "idle-stretch", 8),
    RowSpec(28, "idle-blink-tap", 5),
    RowSpec(29, "idle-look-around-tap", 6),
    RowSpec(30, "idle-hair-sway-tap", 6),
    RowSpec(31, "idle-stretch-tap", 6),
]
SPECS_BY_ROW = {spec.row: spec for spec in ROW_SPECS}
SPECS_BY_STATE = {spec.state: spec for spec in ROW_SPECS}


def parse_key(value: str) -> tuple[int, int, int]:
    normalized = value.strip().lstrip("#")
    if len(normalized) != 6:
        raise ValueError(f"expected RRGGBB key color, got {value!r}")
    return tuple(int(normalized[index : index + 2], 16) for index in (0, 2, 4))


def color_distance(pixel: tuple[int, int, int], key: tuple[int, int, int]) -> float:
    return math.sqrt(sum((pixel[index] - key[index]) ** 2 for index in range(3)))


def remove_chroma(image: Image.Image, key: tuple[int, int, int]) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            green_dominance = green - max(red, blue)
            if color_distance((red, green, blue), key) <= KEY_DISTANCE or (
                key == (0, 255, 0) and green >= 120 and green_dominance >= 45
            ):
                pixels[x, y] = (red, green, blue, 0)
            elif alpha < 255:
                pixels[x, y] = (red, green, blue, alpha)
            elif key == (0, 255, 0) and green_dominance > 18:
                pixels[x, y] = (red, max(red, blue), blue, alpha)
    return rgba


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def frame_bboxes(image: Image.Image, frames: int) -> list[tuple[int, int, int, int]]:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return []

    components = component_bboxes(alpha, bbox)
    if len(components) == frames:
        return components

    counts = []
    for x in range(bbox[0], bbox[2]):
        column = alpha.crop((x, bbox[1], x + 1, bbox[3]))
        counts.append((x, sum(column.histogram()[1:])))

    runs: list[tuple[int, int]] = []
    run_start: int | None = None
    previous_x: int | None = None
    for x, count in counts:
        if count > 12:
            if run_start is None:
                run_start = x
            previous_x = x
        elif run_start is not None and previous_x is not None:
            runs.append((run_start, previous_x + 1))
            run_start = None
            previous_x = None
    if run_start is not None and previous_x is not None:
        runs.append((run_start, previous_x + 1))

    runs = [(left, right) for left, right in runs if right - left >= 8]
    if len(runs) == frames:
        boxes = []
        for left, right in runs:
            crop_bbox = alpha.crop((left, bbox[1], right, bbox[3])).getbbox()
            if crop_bbox is not None:
                boxes.append((left + crop_bbox[0], bbox[1] + crop_bbox[1], left + crop_bbox[2], bbox[1] + crop_bbox[3]))
        return boxes

    slot_boxes = []
    for index in range(frames):
        slot_left = round(alpha.width * index / frames)
        slot_right = round(alpha.width * (index + 1) / frames)
        crop_bbox = alpha.crop((slot_left, 0, slot_right, alpha.height)).getbbox()
        if crop_bbox is not None:
            slot_boxes.append((
                slot_left + crop_bbox[0],
                crop_bbox[1],
                slot_left + crop_bbox[2],
                crop_bbox[3],
            ))
    if len(slot_boxes) == frames:
        return slot_boxes

    left, top, right, bottom = bbox
    width = right - left
    boxes = []
    for index in range(frames):
        slice_left = left + round(width * index / frames)
        slice_right = left + round(width * (index + 1) / frames)
        crop_bbox = alpha.crop((slice_left, top, slice_right, bottom)).getbbox()
        if crop_bbox is not None:
            boxes.append((slice_left + crop_bbox[0], top + crop_bbox[1], slice_left + crop_bbox[2], top + crop_bbox[3]))
    return boxes


def component_bboxes(alpha: Image.Image, bbox: tuple[int, int, int, int]) -> list[tuple[int, int, int, int]]:
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    mask = alpha.crop(bbox)
    pixels = mask.load()
    visited = bytearray(width * height)
    boxes: list[tuple[int, int, int, int, int]] = []

    for start_y in range(height):
        for start_x in range(width):
            index = start_y * width + start_x
            if visited[index] or pixels[start_x, start_y] <= 12:
                continue

            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            visited[index] = 1
            min_x = max_x = start_x
            min_y = max_y = start_y
            count = 0
            while queue:
                x, y = queue.popleft()
                count += 1
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    next_index = ny * width + nx
                    if visited[next_index] or pixels[nx, ny] <= 12:
                        continue
                    visited[next_index] = 1
                    queue.append((nx, ny))

            if count >= 400:
                boxes.append((left + min_x, top + min_y, left + max_x + 1, top + max_y + 1, count))

    boxes.sort(key=lambda item: (item[0], -item[4]))
    return [(left, top, right, bottom) for left, top, right, bottom, _ in boxes]


def remove_small_components(image: Image.Image, minimum_pixels: int = 140) -> Image.Image:
    alpha = image.getchannel("A")
    width, height = image.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    kept = Image.new("L", image.size, 0)
    kept_pixels = kept.load()

    for start_y in range(height):
        for start_x in range(width):
            start_index = start_y * width + start_x
            if visited[start_index] or pixels[start_x, start_y] <= 12:
                continue

            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            visited[start_index] = 1
            component: list[tuple[int, int]] = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for nx in (x - 1, x, x + 1):
                    for ny in (y - 1, y, y + 1):
                        if nx < 0 or ny < 0 or nx >= width or ny >= height or (nx == x and ny == y):
                            continue
                        next_index = ny * width + nx
                        if visited[next_index] or pixels[nx, ny] <= 12:
                            continue
                        visited[next_index] = 1
                        queue.append((nx, ny))

            if len(component) < minimum_pixels:
                continue

            for x, y in component:
                kept_pixels[x, y] = pixels[x, y]

    if kept.getbbox() is None:
        return image

    cleaned = image.copy()
    cleaned.putalpha(kept)
    return cleaned


def normalize_generated_row(source: Path, frames: int, key: tuple[int, int, int]) -> Image.Image:
    with Image.open(source) as opened:
        transparent = remove_chroma(opened, key)

    output = Image.new("RGBA", (ATLAS_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
    boxes = frame_bboxes(transparent, frames)
    if not boxes:
        return output

    max_width = max(right - left for left, _, right, _ in boxes)
    max_height = max(bottom - top for _, top, _, bottom in boxes)
    scale = min((CELL_WIDTH - 12) / max_width, (CELL_HEIGHT - 8) / max_height)
    for index, box in enumerate(boxes[:frames]):
        cropped = transparent.crop(box)
        cropped = remove_small_components(cropped)
        size = (
            max(1, round(cropped.width * scale)),
            max(1, round(cropped.height * scale)),
        )
        resized = cropped.resize(size, Image.Resampling.LANCZOS)
        left = index * CELL_WIDTH + (CELL_WIDTH - size[0]) // 2
        top = (CELL_HEIGHT - size[1]) // 2
        output.alpha_composite(resized, (left, top))
    return output


def replace_row(atlas_path: Path, row_strip: Image.Image, row: int, output_path: Path) -> None:
    with Image.open(atlas_path) as opened:
        atlas = opened.convert("RGBA")

    if atlas.size != (ATLAS_WIDTH, ATLAS_HEIGHT):
        raise ValueError(f"expected atlas {ATLAS_WIDTH}x{ATLAS_HEIGHT}, got {atlas.width}x{atlas.height}")

    patched = atlas.copy()
    top = row * CELL_HEIGHT
    patched.paste((0, 0, 0, 0), (0, top, ATLAS_WIDTH, top + CELL_HEIGHT))
    patched.alpha_composite(row_strip, (0, top))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.suffix.lower() == ".webp":
        patched.save(output_path, format="WEBP", lossless=True, quality=100, method=6)
    else:
        patched.save(output_path)


def save_row(row_strip: Image.Image, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    row_strip.save(output_path)


def contact_sheet(atlas_path: Path, output_path: Path) -> None:
    with Image.open(atlas_path) as opened:
        atlas = opened.convert("RGBA")

    if atlas.size != (ATLAS_WIDTH, ATLAS_HEIGHT):
        raise ValueError(f"expected atlas {ATLAS_WIDTH}x{ATLAS_HEIGHT}, got {atlas.width}x{atlas.height}")

    scale = 0.5
    label_width = 0
    row_height = round(CELL_HEIGHT * scale)
    sheet = Image.new("RGBA", (label_width + round(ATLAS_WIDTH * scale), row_height * ROWS), (245, 245, 245, 255))
    for row in range(ROWS):
        strip = atlas.crop((0, row * CELL_HEIGHT, ATLAS_WIDTH, (row + 1) * CELL_HEIGHT))
        strip = strip.resize((round(ATLAS_WIDTH * scale), row_height), Image.Resampling.NEAREST)
        sheet.alpha_composite(strip, (label_width, row * row_height))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output_path)


def validate(atlas_path: Path, output_path: Path) -> None:
    with Image.open(atlas_path) as opened:
        image = opened.convert("RGBA")

    errors: list[str] = []
    if image.size != (ATLAS_WIDTH, ATLAS_HEIGHT):
        errors.append(f"expected {ATLAS_WIDTH}x{ATLAS_HEIGHT}, got {image.width}x{image.height}")

    warnings: list[str] = []
    cells: list[dict[str, object]] = []
    for spec in ROW_SPECS:
        for column in range(COLUMNS):
            cell = image.crop((
                column * CELL_WIDTH,
                spec.row * CELL_HEIGHT,
                (column + 1) * CELL_WIDTH,
                (spec.row + 1) * CELL_HEIGHT,
            ))
            alpha_count = sum(cell.getchannel("A").histogram()[1:])
            used = column < spec.frames
            cells.append({
                "state": spec.state,
                "row": spec.row,
                "column": column,
                "used": used,
                "nontransparentPixels": alpha_count,
            })
            if used and alpha_count < 80:
                errors.append(f"{spec.state} row {spec.row} col {column} is empty or too sparse")
            if not used and alpha_count:
                warnings.append(f"{spec.state} row {spec.row} col {column} is outside runtime frame count but non-empty")

    result = {"ok": not errors, "errors": errors, "warnings": warnings, "cells": cells}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    if errors:
        raise SystemExit(json.dumps({"ok": False, "errors": errors}, indent=2))


def spec_from_args(row: int | None, state: str | None) -> RowSpec:
    if state:
        try:
            return SPECS_BY_STATE[state]
        except KeyError as error:
            raise ValueError(f"unknown state {state!r}") from error
    if row is None:
        raise ValueError("pass --row or --state")
    try:
        return SPECS_BY_ROW[row]
    except KeyError as error:
        raise ValueError(f"unknown row {row}") from error


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    normalize_parser = subparsers.add_parser("normalize-row")
    normalize_parser.add_argument("--source", required=True)
    normalize_parser.add_argument("--output", required=True)
    normalize_parser.add_argument("--row", type=int)
    normalize_parser.add_argument("--state")
    normalize_parser.add_argument("--key", default="#00ff00")

    replace_parser = subparsers.add_parser("replace-row")
    replace_parser.add_argument("--atlas", required=True)
    replace_parser.add_argument("--source", required=True)
    replace_parser.add_argument("--output", required=True)
    replace_parser.add_argument("--row-output")
    replace_parser.add_argument("--row", type=int)
    replace_parser.add_argument("--state")
    replace_parser.add_argument("--key", default="#00ff00")

    contact_parser = subparsers.add_parser("contact-sheet")
    contact_parser.add_argument("--atlas", required=True)
    contact_parser.add_argument("--output", required=True)

    validate_parser = subparsers.add_parser("validate")
    validate_parser.add_argument("--atlas", required=True)
    validate_parser.add_argument("--output", required=True)

    args = parser.parse_args()

    if args.command == "normalize-row":
        spec = spec_from_args(args.row, args.state)
        row_strip = normalize_generated_row(Path(args.source), spec.frames, parse_key(args.key))
        save_row(row_strip, Path(args.output))
    elif args.command == "replace-row":
        spec = spec_from_args(args.row, args.state)
        row_strip = normalize_generated_row(Path(args.source), spec.frames, parse_key(args.key))
        if args.row_output:
            save_row(row_strip, Path(args.row_output))
        replace_row(Path(args.atlas), row_strip, spec.row, Path(args.output))
    elif args.command == "contact-sheet":
        contact_sheet(Path(args.atlas), Path(args.output))
    elif args.command == "validate":
        validate(Path(args.atlas), Path(args.output))


if __name__ == "__main__":
    main()
