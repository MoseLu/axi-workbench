#!/usr/bin/env python3
"""Normalize Miku redraw row strips and compose the 32-row Runner atlas."""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


CELL_WIDTH = 192
CELL_HEIGHT = 208
COLUMNS = 8
ATLAS_WIDTH = CELL_WIDTH * COLUMNS
KEY_DISTANCE = 44
MIN_FRAME_GAP = 24
PROJECTION_THRESHOLD = 8


@dataclass(frozen=True)
class RowSpec:
    row: int
    state: str
    frames: int


def color_distance(pixel: tuple[int, int, int], key: tuple[int, int, int]) -> float:
    return math.sqrt(sum((pixel[index] - key[index]) ** 2 for index in range(3)))


def sample_key(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    points = [
        (0, 0),
        (rgb.width - 1, 0),
        (0, rgb.height - 1),
        (rgb.width - 1, rgb.height - 1),
    ]
    values = [rgb.getpixel(point) for point in points]
    return max(set(values), key=values.count)


def remove_chroma(image: Image.Image, key: tuple[int, int, int]) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            if color_distance((red, green, blue), key) <= KEY_DISTANCE:
                pixels[x, y] = (red, green, blue, 0)
            elif alpha < 255:
                pixels[x, y] = (red, green, blue, alpha)
    return rgba


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def source_has_alpha(image: Image.Image) -> bool:
    if "A" not in image.getbands():
        return False
    return image.getchannel("A").getextrema()[0] < 255


def prepare_transparent_source(image: Image.Image) -> Image.Image:
    if source_has_alpha(image):
        return image.convert("RGBA")
    key = sample_key(image)
    return remove_chroma(image, key)


def fit_strip(image: Image.Image) -> Image.Image:
    bbox = alpha_bbox(image)
    output = Image.new("RGBA", (ATLAS_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
    if bbox is None:
        return output

    cropped = image.crop(bbox)
    scale = min(ATLAS_WIDTH / cropped.width, CELL_HEIGHT / cropped.height)
    size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    output.alpha_composite(resized, ((ATLAS_WIDTH - size[0]) // 2, (CELL_HEIGHT - size[1]) // 2))
    return output


def find_frame_spans(image: Image.Image, frame_count: int) -> list[tuple[int, int]]:
    alpha = image.getchannel("A")
    projection = []
    for x in range(image.width):
        column = alpha.crop((x, 0, x + 1, image.height))
        projection.append(sum(column.histogram()[1:]))

    spans: list[tuple[int, int]] = []
    start: int | None = None
    last_seen: int | None = None
    for x, count in enumerate(projection):
        if count > PROJECTION_THRESHOLD:
            if start is None:
                start = x
            last_seen = x
        elif start is not None and last_seen is not None and x - last_seen >= MIN_FRAME_GAP:
            spans.append((start, last_seen + 1))
            start = None
            last_seen = None
    if start is not None and last_seen is not None:
        spans.append((start, last_seen + 1))

    if len(spans) >= frame_count:
        return spans[:frame_count]

    bbox = alpha_bbox(image)
    if bbox is not None:
        source_left, _, source_right, _ = bbox
    else:
        source_left, source_right = 0, image.width
    source_width = max(1, source_right - source_left)
    slot_width = source_width / frame_count
    return [
        (
            round(source_left + index * slot_width),
            round(source_left + (index + 1) * slot_width),
        )
        for index in range(frame_count)
    ]


def fit_frame_into_cell(frame: Image.Image, output: Image.Image, column: int) -> None:
    bbox = alpha_bbox(frame)
    if bbox is None:
        return

    cropped = frame.crop(bbox)
    scale = min((CELL_WIDTH - 8) / cropped.width, (CELL_HEIGHT - 8) / cropped.height)
    size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    x = column * CELL_WIDTH + (CELL_WIDTH - size[0]) // 2
    y = (CELL_HEIGHT - size[1]) // 2
    output.alpha_composite(resized, (x, y))


def normalize_framewise(image: Image.Image, frame_count: int) -> Image.Image:
    output = Image.new("RGBA", (ATLAS_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
    spans = find_frame_spans(image, frame_count)
    for column, (left, right) in enumerate(spans):
        frame = image.crop((left, 0, right, image.height))
        fit_frame_into_cell(frame, output, column)
    return clear_unused_cells(output, frame_count)


def clear_unused_cells(strip: Image.Image, frame_count: int) -> Image.Image:
    output = strip.copy()
    for column in range(frame_count, COLUMNS):
        left = column * CELL_WIDTH
        output.paste((0, 0, 0, 0), (left, 0, left + CELL_WIDTH, CELL_HEIGHT))
    return output


def normalize_row(source: Path, output: Path, frame_count: int) -> None:
    with Image.open(source) as opened:
        transparent = prepare_transparent_source(opened)
    if transparent.size == (ATLAS_WIDTH, CELL_HEIGHT):
        strip = clear_unused_cells(transparent, frame_count)
    else:
        strip = normalize_framewise(transparent, frame_count)
    strip = clear_unused_cells(strip, frame_count)
    output.parent.mkdir(parents=True, exist_ok=True)
    strip.save(output)


def load_rows(manifest: Path) -> list[RowSpec]:
    data = json.loads(manifest.read_text(encoding="utf-8"))
    return [
        RowSpec(row=item["row"], state=item["state"], frames=item["frames"])
        for item in data["rows"]
    ]


def normalize_all(run_dir: Path) -> None:
    rows = load_rows(run_dir / "redraw-job-manifest.json")
    for row in rows:
        source = run_dir / "generated-rows" / f"{row.row:02d}-{row.state}-source.png"
        if not source.exists():
            continue
        output = run_dir / "selected-rows" / f"{row.row:02d}-{row.state}.png"
        normalize_row(source, output, row.frames)
        print(f"normalized {output}")


def compose_atlas(run_dir: Path, output_png: Path, output_webp: Path | None) -> None:
    rows = load_rows(run_dir / "redraw-job-manifest.json")
    atlas = Image.new("RGBA", (ATLAS_WIDTH, CELL_HEIGHT * len(rows)), (0, 0, 0, 0))
    missing: list[str] = []

    for row in rows:
        path = run_dir / "selected-rows" / f"{row.row:02d}-{row.state}.png"
        if not path.exists():
            missing.append(str(path))
            continue
        with Image.open(path) as opened:
            strip = opened.convert("RGBA")
        if strip.size != (ATLAS_WIDTH, CELL_HEIGHT):
            strip = fit_strip(strip)
        atlas.alpha_composite(clear_unused_cells(strip, row.frames), (0, row.row * CELL_HEIGHT))

    if missing:
        raise SystemExit("missing selected rows:\n" + "\n".join(missing))

    output_png.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output_png)
    print(f"wrote {output_png}")
    if output_webp is not None:
        output_webp.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(output_webp, format="WEBP", lossless=True, quality=100, method=6)
        print(f"wrote {output_webp}")


def contact_sheet(run_dir: Path, atlas_path: Path, output: Path) -> None:
    rows = load_rows(run_dir / "redraw-job-manifest.json")
    with Image.open(atlas_path) as opened:
        atlas = opened.convert("RGBA")

    scale = 0.5
    label_width = 180
    row_height = round(CELL_HEIGHT * scale)
    sheet = Image.new("RGBA", (label_width + round(ATLAS_WIDTH * scale), row_height * len(rows)), (245, 245, 245, 255))

    for row in rows:
        strip = atlas.crop((0, row.row * CELL_HEIGHT, ATLAS_WIDTH, (row.row + 1) * CELL_HEIGHT))
        strip = strip.resize((round(ATLAS_WIDTH * scale), row_height), Image.Resampling.NEAREST)
        sheet.alpha_composite(strip, (label_width, row.row * row_height))

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output)
    print(f"wrote {output}")


def validate_atlas(run_dir: Path, atlas_path: Path, json_out: Path) -> None:
    rows = load_rows(run_dir / "redraw-job-manifest.json")
    with Image.open(atlas_path) as opened:
        image = opened.convert("RGBA")

    errors: list[str] = []
    if image.size != (ATLAS_WIDTH, CELL_HEIGHT * len(rows)):
        errors.append(f"expected {ATLAS_WIDTH}x{CELL_HEIGHT * len(rows)}, got {image.width}x{image.height}")

    cells: list[dict[str, object]] = []
    for row in rows:
        for column in range(COLUMNS):
            left = column * CELL_WIDTH
            top = row.row * CELL_HEIGHT
            cell = image.crop((left, top, left + CELL_WIDTH, top + CELL_HEIGHT))
            alpha_count = sum(cell.getchannel("A").histogram()[1:])
            used = column < row.frames
            cells.append({
                "state": row.state,
                "row": row.row,
                "column": column,
                "used": used,
                "nontransparentPixels": alpha_count,
            })
            if used and alpha_count < 80:
                errors.append(f"{row.state} row {row.row} col {column} is empty or too sparse")
            if not used and alpha_count:
                errors.append(f"{row.state} row {row.row} col {column} should be transparent")

    result = {"ok": not errors, "errors": errors, "cells": cells}
    json_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "cells"}, indent=2))
    if errors:
        raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", default="output/miku-redraw-20260504")
    parser.add_argument("--normalize", action="store_true")
    parser.add_argument("--compose", action="store_true")
    parser.add_argument("--contact-sheet", action="store_true")
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--output-png", default="output/miku-redraw-20260504/final/spritesheet.redraw.png")
    parser.add_argument("--output-webp", default="/Users/mose/.codex/pets/miku/spritesheet.redraw.webp")
    parser.add_argument("--contact-output", default="output/miku-redraw-20260504/qa/contact-sheet.png")
    parser.add_argument("--validation-output", default="output/miku-redraw-20260504/qa/validation.json")
    args = parser.parse_args()

    run_dir = Path(args.run_dir).expanduser().resolve()
    output_png = Path(args.output_png).expanduser().resolve()
    output_webp = Path(args.output_webp).expanduser().resolve() if args.output_webp else None

    if args.normalize:
        normalize_all(run_dir)
    if args.compose:
        compose_atlas(run_dir, output_png, output_webp)
    if args.contact_sheet:
        contact_sheet(run_dir, output_png, Path(args.contact_output).expanduser().resolve())
    if args.validate:
        validate_atlas(run_dir, output_png, Path(args.validation_output).expanduser().resolve())


if __name__ == "__main__":
    main()
